// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Transaction } from '@mysten/sui/transactions';
import { Button, Card, Flex, Heading, TextField, Text } from '@radix-ui/themes';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useState } from 'react';
import { useNetworkVariable } from './networkConfig';
import { useNavigate } from 'react-router-dom';
import { Waves, PlusCircle } from 'lucide-react';

export function CreateAllowlist() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const packageId = useNetworkVariable('packageId');
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showEffects: true,
        },
      }),
  });

  function createAllowlist(name: string) {
    if (name === '') {
      alert('请输入支持者等级名称');
      return;
    }
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::allowlist::create_allowlist_entry`,
      arguments: [tx.pure.string(name)],
    });
    tx.setGasBudget(10000000);
    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async (result) => {
          console.log('res', result);
          const allowlistObject = result.effects?.created?.find(
            (item) => item.owner && typeof item.owner === 'object' && 'Shared' in item.owner,
          );
          const createdObjectId = allowlistObject?.reference?.objectId;
          if (createdObjectId) {
            navigate(`/allowlist-example/admin/allowlist/${createdObjectId}`);
          }
        },
      },
    );
  }

  const handleViewAll = () => {
    navigate(`/allowlist-example/admin/allowlists`);
  };

  return (
    <Card style={{ background: 'linear-gradient(to bottom right, #e0f7fa, #b2ebf2)', border: '1px solid #4dd0e1', borderRadius: 'var(--radius-3)' }}>
      <Heading as="h2" size="6" mb="3" style={{ color: '#00796b', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Waves size={24} /> 创建新的支持者等级
      </Heading>
      <Text size="2" color="gray" mb="4">为您的专属内容创建一个新的访问等级。</Text>
      <Flex direction="column" gap="3">
        <TextField.Root
          size="3"
          placeholder="例如：铁杆粉丝、核心赞助者"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            boxShadow: 'inset 0 1px 2px rgba(0, 121, 107, 0.1)',
            borderColor: '#80cbc4',
          }}
        >
          <TextField.Slot>
            <PlusCircle size={16} color="#00796b" />
          </TextField.Slot>
        </TextField.Root>
        <Flex direction="row" gap="3" justify="start" mt="2">
          <Button
            size="3"
            variant="solid"
            color="teal"
            onClick={() => {
              createAllowlist(name);
            }}
            style={{ cursor: 'pointer', fontWeight: '500' }}
            disabled={!name.trim()}
          >
            <PlusCircle size={16} style={{ marginRight: 'var(--space-1)' }} /> 创建等级
          </Button>
          <Button
            size="3"
            variant="outline"
            color="gray"
            onClick={handleViewAll}
            style={{ cursor: 'pointer', color: '#00796b', borderColor: '#80cbc4' }}
          >
            查看我的所有等级
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
}
