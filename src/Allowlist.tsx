// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Button, Card, Flex, Avatar, Box, Separator, Text, TextField } from '@radix-ui/themes'; // Import TextField
import { useNetworkVariable } from './networkConfig';
import { useEffect, useState } from 'react';
import { Droplet, UserPlus, Waves, X } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { isValidSuiAddress } from '@mysten/sui/utils';
import { getObjectExplorerLink } from './utils';

export interface Allowlist {
  id: string;
  name: string;
  list: string[];
}

interface AllowlistProps {
  setRecipientAllowlist: React.Dispatch<React.SetStateAction<string>>;
  setCapId: React.Dispatch<React.SetStateAction<string>>;
}

export function Allowlist({ setRecipientAllowlist, setCapId }: AllowlistProps) {
  const packageId = useNetworkVariable('packageId');
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const [allowlist, setAllowlist] = useState<Allowlist>();
  const { id } = useParams();
  const [capId, setInnerCapId] = useState<string>();
  const [newAddress, setNewAddress] = useState(''); // State for the input field

  useEffect(() => {
    async function getAllowlist() {
      // load all caps
      const res = await suiClient.getOwnedObjects({
        owner: currentAccount?.address!,
        options: {
          showContent: true,
          showType: true,
        },
        filter: {
          StructType: `${packageId}::allowlist::Cap`,
        },
      });

      // find the cap for the given allowlist id
      const capId = res.data
        .map((obj) => {
          const fields = (obj!.data!.content as { fields: any }).fields;
          return {
            id: fields?.id.id,
            allowlist_id: fields?.allowlist_id,
          };
        })
        .filter((item) => item.allowlist_id === id)
        .map((item) => item.id) as string[];
      setCapId(capId[0]);
      setInnerCapId(capId[0]);

      // load the allowlist for the given id
      const allowlist = await suiClient.getObject({
        id: id!,
        options: { showContent: true },
      });
      const fields = (allowlist.data?.content as { fields: any })?.fields || {};
      setAllowlist({
        id: id!,
        name: fields.name,
        list: fields.list,
      });
      setRecipientAllowlist(id!);
    }

    // Call getAllowlist immediately
    getAllowlist();

    // Set up interval to call getAllowlist every 3 seconds
    const intervalId = setInterval(() => {
      getAllowlist();
    }, 3000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [id, currentAccount?.address]); // Only depend on id

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

  const addItem = (newAddressToAdd: string, wl_id: string, cap_id: string) => {
    const trimmedAddress = newAddressToAdd.trim();
    if (trimmedAddress !== '') {
      if (!isValidSuiAddress(trimmedAddress)) {
        alert('无效的 Sui 地址');
        return;
      }
      const tx = new Transaction();
      tx.moveCall({
        arguments: [tx.object(wl_id), tx.object(cap_id), tx.pure.address(trimmedAddress)],
        target: `${packageId}::allowlist::add`,
      });
      tx.setGasBudget(10000000);

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            console.log('添加成功:', result);
            setNewAddress(''); // Clear input field on success
            // Optionally trigger a refresh of the allowlist data here
            // getAllowlist(); // Re-fetch data
          },
          onError: (error) => {
            console.error('添加失败:', error);
            alert(`添加失败: ${error.message}`);
          }
        },
      );
    }
  };

  const removeItem = (addressToRemove: string, wl_id: string, cap_id: string) => {
    const trimmedAddress = addressToRemove.trim();
    if (trimmedAddress !== '') {
      const tx = new Transaction();
      tx.moveCall({
        arguments: [tx.object(wl_id), tx.object(cap_id), tx.pure.address(trimmedAddress)],
        target: `${packageId}::allowlist::remove`,
      });
      tx.setGasBudget(10000000);

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            console.log('移除成功:', result);
            // Optionally trigger a refresh of the allowlist data here
            // getAllowlist(); // Re-fetch data
          },
          onError: (error) => {
            console.error('移除失败:', error);
            alert(`移除失败: ${error.message}`);
          }
        },
      );
    }
  };

  return (
    <Flex direction="column" gap="4" justify="start" style={{ maxWidth: '700px', margin: '0 auto' }}>
      {/* 主卡片，使用更柔和的渐变和阴影 */}
      <Card style={{
        background: 'linear-gradient(145deg, #e6f7ff 0%, #cffafe 100%)', // 更柔和的蓝青渐变
        borderRadius: 'var(--radius-4)', // 更大的圆角
        boxShadow: '0 8px 20px rgba(0, 121, 107, 0.1)', // 更柔和的阴影
        border: '1px solid rgba(0, 150, 136, 0.1)', // 细微边框
        overflow: 'hidden', // 确保内部元素不溢出圆角
      }}>
        {/* 顶部区域，模拟水波纹背景 */}
        <Box style={{
          // 使用 CSS 渐变模拟水波纹，比 SVG 更轻量
          background: 'radial-gradient(circle at 50% 100%, rgba(178, 235, 242, 0.5) 0%, rgba(178, 235, 242, 0) 70%), linear-gradient(to top, #e0f7fa, #e6f7ff)',
          padding: 'var(--space-5)', // 增加内边距
        }}>
          <Flex gap="4" align="center">
            <Avatar
              size="5" // 稍大尺寸
              radius="full"
              fallback={<Droplet color="#00796b" />} // 深水鸭色图标
              color="cyan"
              style={{
                backgroundColor: 'white', // 白色背景更突出
                boxShadow: '0 4px 8px rgba(0, 121, 107, 0.15)' // 阴影
              }}
            />
            <Box>
              <Text as="div" size="5" weight="bold" style={{ color: '#00695c' }}> {/* 深水鸭色 */}
                创作者空间
              </Text>
              <Text as="div" size="2" style={{ color: '#00897b' }}> {/* 中等水鸭色 */}
                管理您的专属支持者名单
              </Text>
            </Box>
          </Flex>
        </Box>

        {/* 内容区域 */}
        <Box p="5">
          <Flex align="center" gap="2" mb="2">
            <Waves size={22} color="#00796b" />
            <Text size="4" weight="medium" style={{ color: '#004d40' }}> {/* 深绿/水鸭色 */}
              支持者等级: {allowlist?.name || '加载中...'}
            </Text>
          </Flex>
          <Text size="2" color="gray" style={{ marginBottom: 'var(--space-4)', display: 'block' }}>
            名单 ID: {allowlist?.id ? getObjectExplorerLink(allowlist.id) : '加载中...'}
          </Text>

          <Box mb="5" p="3" style={{ background: 'rgba(224, 247, 250, 0.5)', borderRadius: 'var(--radius-3)', border: '1px dashed rgba(0, 121, 107, 0.2)' }}>
            <Text size="3" style={{ color: '#00695c', display: 'block', marginBottom: 'var(--space-2)' }}>
              分享此专属链接邀请支持者:
            </Text>
            <a
              href={`${window.location.origin}/allowlist-example/view/allowlist/${allowlist?.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#00796b',
                fontWeight: '500',
                wordBreak: 'break-all', // 长链接换行
                textDecoration: 'underline',
                textDecorationStyle: 'wavy', // 波浪下划线
                textDecorationColor: 'rgba(0, 121, 107, 0.4)',
                paddingBottom: '2px',
                transition: 'color 0.3s ease, text-decoration-color 0.3s ease',
              }}
              onMouseOver={e => { e.currentTarget.style.color = '#004d40'; e.currentTarget.style.textDecorationColor = 'rgba(0, 77, 64, 0.6)'; }}
              onMouseOut={e => { e.currentTarget.style.color = '#00796b'; e.currentTarget.style.textDecorationColor = 'rgba(0, 121, 107, 0.4)'; }}
            >
              {`${window.location.origin}/allowlist-example/view/allowlist/${allowlist?.id || '...'}`}
            </a>
          </Box>

          {/* 添加支持者区域 */}
          <Flex direction={{ initial: 'column', sm: 'row' }} gap="3" align="stretch" mb="5">
            {/* 使用 Radix TextField for better consistency */}
            <TextField.Root
              placeholder="添加支持者钱包地址"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              style={{ flexGrow: 1 }}
              size="3" // Larger size
            >
              <TextField.Slot>
                {/* Optional: Add an icon */}
              </TextField.Slot>
            </TextField.Root>
            <Button
              variant="solid" // 实心按钮更醒
              color="teal"
              size="3" // Match TextField size
              onClick={() => {
                if (id && capId) {
                  addItem(newAddress, id, capId);
                } else {
                  alert('无法获取名单或权限信息');
                }
              }}
              disabled={!id || !capId || !newAddress.trim()} // Disable if no ID/CapID or input empty
              style={{ cursor: !id || !capId || !newAddress.trim() ? 'not-allowed' : 'pointer', transition: 'background-color 0.3s ease' }}
            >
              <UserPlus size={18} style={{ marginRight: 'var(--space-2)' }} />
              授予访问权限
            </Button>
          </Flex>

          {/* 支持者列表 */}
          <Separator size="4" style={{ margin: 'var(--space-4) 0', backgroundColor: 'rgba(0, 121, 107, 0.15)' }} />
          <h4 style={{ color: '#00695c', marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-4)' }}>当前支持者列表:</h4>
          {Array.isArray(allowlist?.list) && allowlist?.list.length > 0 ? (
            <ul style={{ listStyle: 'none', paddingLeft: '0', margin: '0', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {allowlist?.list.map((listItem, itemIndex) => (
                <li
                  key={itemIndex}
                  style={{
                    background: 'rgba(255, 255, 255, 0.8)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-3)',
                    border: '1px solid rgba(178, 223, 219, 0.7)', // 浅水鸭色边框
                    boxShadow: '0 2px 4px rgba(0, 121, 107, 0.05)',
                    transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
                  }}
                  onMouseOver={e => { e.currentTarget.style.backgroundColor = 'rgba(224, 247, 250, 0.6)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 121, 107, 0.1)'; }}
                  onMouseOut={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 121, 107, 0.05)'; }}
                >
                  <Flex direction="row" gap="3" align="center" justify="between">
                    <Text size="2" style={{ color: '#004d40', fontFamily: 'monospace', overflowWrap: 'break-word', wordBreak: 'break-all', flexGrow: 1, marginRight: 'var(--space-2)' }}>
                      {listItem}
                    </Text>
                    <Button
                      variant="soft" // Soft variant for less emphasis
                      color="red"
                      size="1"
                      radius="full"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (id && capId) {
                          removeItem(listItem, id, capId);
                        } else {
                          alert('无法获取名单或权限信息');
                        }
                      }}
                      disabled={!id || !capId}
                      style={{ cursor: !id || !capId ? 'not-allowed' : 'pointer', flexShrink: 0, transition: 'background-color 0.3s ease' }}
                      title="移除支持者"
                    >
                      <X size={14} />
                    </Button>
                  </Flex>
                </li>
              ))}
            </ul>
          ) : (
            <Text size="2" color="gray" style={{ fontStyle: 'italic', textAlign: 'center', padding: 'var(--space-4) 0' }}>
              还没有支持者加入。邀请他们来吧！
            </Text>
          )}
        </Box>
      </Card>
    </Flex>
  );
}
