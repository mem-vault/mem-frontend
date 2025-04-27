// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useEffect, useState } from 'react';
import { useNetworkVariable } from './networkConfig';
import { Button, Card, Flex, Text, Box, Heading, Grid } from '@radix-ui/themes';
import { getObjectExplorerLink } from './utils';
import { GearIcon, PlusIcon } from '@radix-ui/react-icons';

export interface Cap {
  id: string;
  service_id: string;
}

export interface CardItem {
  id: string;
  fee: string;
  ttl: string;
  name: string;
  owner: string;
  description?: string;
}

export function AllServices() {
  const packageId = useNetworkVariable('packageId');
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();

  const [cardItems, setCardItems] = useState<CardItem[]>([]);

  useEffect(() => {
    async function getCapObj() {
      if (!currentAccount?.address) return;

      try {
        const res = await suiClient.getOwnedObjects({
          owner: currentAccount.address,
          options: {
            showContent: true,
            showType: true,
          },
          filter: {
            StructType: `${packageId}::subscription::Cap`,
          },
        });
        const caps = res.data
          .map((obj) => {
            const fields = (obj?.data?.content as { fields: any })?.fields;
            if (!fields || !fields.id || !fields.service_id) {
              console.warn('Skipping object with missing fields:', obj);
              return null;
            }
            return {
              id: fields.id.id,
              service_id: fields.service_id,
            };
          })
          .filter((item): item is Cap => item !== null);

        const cardItemsPromises = caps.map(async (cap): Promise<CardItem | null> => {
          try {
            const service = await suiClient.getObject({
              id: cap.service_id,
              options: { showContent: true },
            });
            const fields = (service.data?.content as { fields: any })?.fields;
            if (!fields || !fields.fee || !fields.ttl || !fields.owner || !fields.name) {
              console.warn('Skipping service with missing fields:', cap.service_id);
              return null;
            }
            return {
              id: cap.service_id,
              fee: fields.fee,
              ttl: fields.ttl,
              owner: fields.owner,
              name: fields.name,
              description: fields.description || '暂无描述，点击管理添加。',
            };
          } catch (error) {
            console.error(`Failed to fetch service object ${cap.service_id}:`, error);
            return null;
          }
        });

        const resolvedCardItems = (await Promise.all(cardItemsPromises)).filter(
          (item): item is CardItem => item !== null,
        );
        setCardItems(resolvedCardItems);
      } catch (error) {
        console.error("Failed to fetch owned objects:", error);
      }
    }

    getCapObj();

    const intervalId = setInterval(getCapObj, 5000);

    return () => clearInterval(intervalId);
  }, [currentAccount?.address, packageId, suiClient]);

  const formatTtl = (ttl: string): string => {
    const ttlMs = parseInt(ttl);
    if (isNaN(ttlMs) || ttlMs <= 0) return '永久';
    const days = Math.floor(ttlMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ttlMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ttlMs % (1000 * 60 * 60)) / (1000 * 60));

    let result = '';
    if (days > 0) result += `${days}天 `;
    if (hours > 0) result += `${hours}小时 `;
    if (minutes > 0) result += `${minutes}/50`;

    return result.trim() || '小于1分钟';
  };

  return (
    <Box style={{ padding: 'var(--space-6)', maxWidth: '1200px', margin: '0 auto' }}>
      <Heading
        align="center"
        size="8"
        mb="3"
        style={{
          color: 'var(--cyan-11)',
          fontWeight: '700',
          textShadow: '1px 1px 3px rgba(0, 139, 139, 0.2)',
        }}
      >
        我的创作者空间
      </Heading>
      <Text
        as="p"
        align="center"
        size="4"
        mb="7"
        style={{ color: 'var(--teal-10)', maxWidth: '600px', margin: '0 auto' }}
      >
        管理您创建的会员服务层级。点击卡片上的“配置”按钮上传内容或调整设置。
      </Text>

      <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="6">
        {cardItems.length === 0 ? (
          <Card
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: 'var(--space-6)',
              background: 'var(--cyan-2)',
              border: '1px dashed var(--cyan-7)',
              borderRadius: 'var(--radius-4)',
            }}
          >
            <Text color="gray" size="4">
              🌊 还没有创建任何会员层级？
            </Text>
            <Button
              mt="4"
              size="3"
              variant="soft"
              color="cyan"
              onClick={() => window.location.href = '/subscription-example'}
              style={{ cursor: 'pointer' }}
            >
              <PlusIcon width="16" height="16" />
              立即创建第一个
            </Button>
          </Card>
        ) : (
          cardItems.map((item) => (
            <Card
              key={item.id}
              style={{
                background: 'linear-gradient(135deg, var(--cyan-3) 0%, var(--teal-4) 100%)',
                borderRadius: 'var(--radius-5)',
                boxShadow: '0 8px 25px -5px rgba(0, 150, 136, 0.15), 0 5px 15px -6px rgba(0, 0, 0, 0.1)',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 12px 30px -5px rgba(0, 150, 136, 0.25), 0 8px 20px -6px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 8px 25px -5px rgba(0, 150, 136, 0.15), 0 5px 15px -6px rgba(0, 0, 0, 0.1)';
              }}
            >
              <Box style={{
                height: '8px',
                background: 'linear-gradient(to right, var(--cyan-5), var(--teal-6))',
                marginBottom: 'var(--space-4)',
              }} />

              <Flex direction="column" gap="3" p="4" style={{ flexGrow: 1 }}>
                <Heading
                  as="h3"
                  size="6"
                  weight="bold"
                  align="center"
                  style={{ color: 'var(--teal-11)', minHeight: '2.5em' }}
                >
                  {item.name}
                </Heading>
                <Text size="2" color="gray" align="center" style={{ wordBreak: 'break-all' }}>
                  (层级 ID: {getObjectExplorerLink(item.id)})
                </Text>
                <Text size="3" style={{ color: 'var(--cyan-11)', flexGrow: 1, marginBottom: 'var(--space-4)', minHeight: '4em' }}>
                  {item.description || '点击“配置”添加层级描述...'}
                </Text>

                <Flex justify="between" align="center">
                  <Text size="3" weight="medium" style={{ color: 'var(--teal-10)' }}>
                    空间币价:
                  </Text>
                  <Text size="3" weight="bold" style={{ color: 'var(--teal-12)' }}>
                    {item.fee} MIST
                  </Text>
                </Flex>
                <Flex justify="between" align="center" mb="5">
                  <Text size="3" weight="medium" style={{ color: 'var(--teal-10)' }}>
                    订阅人数:
                  </Text>
                  <Text size="3" weight="bold" style={{ color: 'var(--teal-12)' }}>
                    {formatTtl(item.ttl)}
                  </Text>
                </Flex>

                <Button
                  size="3"
                  variant="solid"
                  color="teal"
                  onClick={() => {
                    window.open(
                      `${window.location.origin}/subscription-example/admin/service/${item.id}`,
                      '_blank',
                    );
                  }}
                  style={{
                    cursor: 'pointer',
                    fontWeight: '600',
                    borderRadius: 'var(--radius-3)',
                    width: '100%',
                    transition: 'background-color 0.2s ease, transform 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--teal-10)';
                    e.currentTarget.style.transform = 'scale(1.03)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <GearIcon width="16" height="16" style={{ marginRight: 'var(--space-2)' }} /> 配置层级
                </Button>
              </Flex>
            </Card>
          ))
        )}
      </Grid>
    </Box>
  );
}
