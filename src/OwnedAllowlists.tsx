// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useCallback, useEffect, useState } from 'react';
import { useNetworkVariable } from './networkConfig';
import { Button, Card, Box, Flex, Grid, Heading, Text, Link } from '@radix-ui/themes';
import { getObjectExplorerLink } from './utils';

export interface Cap {
  id: string;
  allowlist_id: string;
}

export interface CardItem {
  cap_id: string;
  allowlist_id: string;
  list: string[];
  name: string;
}

export function AllAllowlist() {
  const packageId = useNetworkVariable('packageId');
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();

  const [cardItems, setCardItems] = useState<CardItem[]>([]);

  const getCapObj = useCallback(async () => {
    if (!currentAccount?.address) return;

    try {
      const res = await suiClient.getOwnedObjects({
        owner: currentAccount?.address,
        options: {
          showContent: true,
          showType: true,
        },
        filter: {
          StructType: `${packageId}::allowlist::Cap`,
        },
      });
      const caps = res.data
        .map((obj) => {
          const fields = (obj?.data?.content as { fields: any })?.fields;
          if (!fields) return null;
          return {
            id: fields?.id.id,
            allowlist_id: fields?.allowlist_id,
          };
        })
        .filter((item): item is Cap => item !== null);

      const fetchedCardItems: CardItem[] = await Promise.all(
        caps.map(async (cap) => {
          const allowlist = await suiClient.getObject({
            id: cap.allowlist_id,
            options: { showContent: true },
          });
          const fields = (allowlist.data?.content as { fields: any })?.fields || {};
          return {
            cap_id: cap.id,
            allowlist_id: cap.allowlist_id,
            list: fields.list || [],
            name: fields.name || 'Unnamed Allowlist',
          };
        }),
      );
      setCardItems(fetchedCardItems);
    } catch (error) {
      console.error("Failed to fetch owned allowlists:", error);
    }
  }, [currentAccount?.address, packageId, suiClient]);

  useEffect(() => {
    getCapObj();
  }, [getCapObj]);

  return (
    <Box p="5" style={{ borderRadius: '16px', background: 'rgba(230, 249, 253, 0.7)', backdropFilter: 'blur(5px)', border: '1px solid rgba(173, 232, 244, 0.5)', boxShadow: '0 4px 15px rgba(173, 232, 244, 0.15)' }}>
      <Heading as="h2" size="7" mb="2" style={{ color: '#005f73', fontWeight: 'bold' }}>
        我的内容访问列表
      </Heading>
      <Text as="p" size="3" mb="6" style={{ color: '#023e8a' }}>
        管理您创建的访问列表。点击“管理”按钮编辑列表成员或上传与列表关联的新内容。
      </Text>

      {cardItems.length > 0 ? (
        <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="5">
          {cardItems.map((item) => (
            <Card key={`${item.cap_id}-${item.allowlist_id}`} style={{ background: 'rgba(255, 255, 255, 0.85)', borderRadius: '12px', border: '1px solid rgba(144, 224, 239, 0.6)', transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out' }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(144, 224, 239, 0.3)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <Flex direction="column" gap="3">
                <Heading as="h3" size="4" style={{ color: '#0077b6', fontWeight: '600' }}>
                  {item.name}
                </Heading>
                <Text size="2" color="gray">
                  列表 ID: <Link href={getObjectExplorerLink(item.allowlist_id)} target="_blank" rel="noopener noreferrer" style={{ color: '#0096c7' }}>{item.allowlist_id.substring(0, 6)}...{item.allowlist_id.substring(item.allowlist_id.length - 4)}</Link>
                </Text>
                <Text size="2" color="gray">
                  成员数量: {item.list.length}
                </Text>
                <Button
                  onClick={() => {
                    window.open(
                      `${window.location.origin}/allowlist-example/admin/allowlist/${item.allowlist_id}`,
                      '_blank',
                    );
                  }}
                  variant="soft"
                  style={{
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #80deea, #4dd0e1)',
                    color: '#004d40',
                    fontWeight: 'bold',
                    marginTop: 'auto',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 2px 5px rgba(77, 208, 225, 0.3)'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, #4dd0e1, #26c6da)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(77, 208, 225, 0.5)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, #80deea, #4dd0e1)'; e.currentTarget.style.boxShadow = '0 2px 5px rgba(77, 208, 225, 0.3)'; }}
                >
                  管理列表
                </Button>
              </Flex>
            </Card>
          ))}
        </Grid>
      ) : (
        <Flex justify="center" align="center" style={{ minHeight: '150px', background: 'rgba(255, 255, 255, 0.6)', borderRadius: '12px', border: '1px dashed rgba(144, 224, 239, 0.6)' }}>
          <Text color="gray" size="3">您还没有创建任何访问列表。</Text>
        </Flex>
      )}
    </Box>
  );
}
