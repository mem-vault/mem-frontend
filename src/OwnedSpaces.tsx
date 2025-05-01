// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
// 用到了，是创建的全部space

import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useEffect, useState } from 'react';
import { useNetworkVariable } from './networkConfig';
// 导入更多 Radix 组件以实现更丰富的布局和样式
import { Button, Card, Flex, Text, Heading, Box, Link as RadixLink, Grid, Separator } from '@radix-ui/themes';
import { getObjectExplorerLink } from './utils';
import { ExternalLinkIcon } from '@radix-ui/react-icons'; // 导入图标

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
}

// --- 定义调色板 ---
const deepOceanBlue = 'hsl(210, 40%, 8%)'; // 深邃的背景色
const midnightBlue = 'hsl(210, 35%, 12%)'; // 卡片背景色
const vibrantBlue = 'hsl(205, 90%, 55%)'; // 强调色/按钮色
const subtleBlueGray = 'hsl(215, 15%, 50%)'; // 次要文本/边框色
const lightText = 'hsl(210, 20%, 95%)'; // 主要文本色
const cardBorderColor = 'hsla(210, 30%, 30%, 0.5)'; // 卡片边框色

export function OwnedSpaces() {
  const packageId = useNetworkVariable('packageId');
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();

  const [cardItems, setCardItems] = useState<CardItem[]>([]);

  useEffect(() => {
    async function getCapObj() {
      if (!currentAccount?.address) return; // 如果没有地址则提前返回

      // get all owned cap objects
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
          if (!fields) return null; // 添加检查以防 fields 未定义
          return {
            id: fields.id.id,
            service_id: fields.service_id,
          };
        })
        .filter((item): item is Cap => item !== null); // 使用类型谓词进行过滤

      // get all services of all the owned cap objects
      const cardItemsPromises: Promise<CardItem | null>[] = caps.map(async (cap) => {
        try {
          const service = await suiClient.getObject({
            id: cap.service_id,
            options: { showContent: true },
          });
          const fields = (service.data?.content as { fields: any })?.fields;
          if (!fields) return null; // 添加检查
          return {
            id: cap.service_id,
            fee: fields.fee,
            ttl: fields.ttl,
            owner: fields.owner,
            name: fields.name,
          };
        } catch (error) {
          console.error(`Failed to fetch service object ${cap.service_id}:`, error);
          return null; // 处理获取对象失败的情况
        }
      });

      const resolvedCardItems = await Promise.all(cardItemsPromises);
      setCardItems(resolvedCardItems.filter((item): item is CardItem => item !== null)); // 过滤掉 null 值
    }

    // Call getCapObj immediately
    getCapObj();

    // Set up interval to call getCapObj every 5 seconds (稍微延长间隔)
    const intervalId = setInterval(() => {
      getCapObj();
    }, 5000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
    // 依赖项中包含 packageId 和 suiClient，以确保在它们更改时重新运行
  }, [currentAccount?.address, packageId, suiClient]);

  // --- UI 渲染 ---
  return (
    <Box style={{
      background: `linear-gradient(180deg, ${deepOceanBlue} 0%, ${midnightBlue} 100%)`, // 深色渐变背景
      padding: 'var(--space-5) var(--space-6)', // 使用 Radix 间距变量
      minHeight: 'calc(100vh - 80px)', // 假设顶部导航栏高度为 80px
      color: lightText,
    }}>
      <Heading size="7" mb="3" style={{ fontWeight: 600 }}>
        My Created Spaces
      </Heading>
      <Text size="3" color="gray" mb="6" style={{ color: subtleBlueGray }}>
        Manage your digital realms. Upload content and oversee your creations.
      </Text>

      {cardItems.length > 0 ? (
        <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="5">
          {cardItems.map((item) => (
            <Card key={item.id} style={{
              background: `linear-gradient(145deg, ${midnightBlue}, ${deepOceanBlue})`, // 卡片内部渐变
              borderRadius: 'var(--radius-4)', // Radix 圆角
              border: `1px solid ${cardBorderColor}`,
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)', // 更柔和的阴影
              transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out',
              ':hover': { // Radix 不直接支持伪类，这只是示意，需要 CSS Modules 或 styled-components 实现
                transform: 'translateY(-4px)',
                boxShadow: `0 12px 25px rgba(0, 120, 255, 0.2)`,
              }
            }}>
              <Flex direction="column" gap="3">
                <Heading size="5" style={{ color: lightText, fontWeight: 500 }}>
                  {item.name || 'Unnamed Space'} {/* 提供默认名称 */}
                </Heading>

                <Flex align="center" gap="2">
                  <Text size="2" color="gray" style={{ color: subtleBlueGray }}>ID:</Text>
                  <RadixLink
                    href={getObjectExplorerLink(item.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="2"
                    style={{ color: vibrantBlue, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {`${item.id.substring(0, 6)}...${item.id.substring(item.id.length - 4)}`}
                    <ExternalLinkIcon width="14" height="14" />
                  </RadixLink>
                </Flex>

                <Separator size="4" my="2" style={{ background: cardBorderColor }} />

                <Flex justify="between" align="center">
                  <Text size="2" style={{ color: subtleBlueGray }}>Fee:</Text>
                  <Text size="2" weight="medium" style={{ color: lightText }}>{item.fee ? `${parseInt(item.fee) / 1_000_000_000} SUI` : 'N/A'}</Text> {/* 假设 fee 是 MIST */}
                </Flex>
                <Flex justify="between" align="center">
                  <Text size="2" style={{ color: subtleBlueGray }}>Duration:</Text>
                  <Text size="2" weight="medium" style={{ color: lightText }}>
                    {item.ttl ? `${Math.round(parseInt(item.ttl) / 60000)} min` : 'N/A'} {/* 转换为分钟 */}
                  </Text>
                </Flex>

                <Button
                  mt="3"
                  style={{
                    background: vibrantBlue,
                    color: 'white',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                  }}
                  onClick={() => {
                    // 考虑使用 React Router 的 navigate 进行导航，而不是 window.open
                    window.open(
                      `${window.location.origin}/subscription-example/admin/service/${item.id}`,
                      '_blank',
                    );
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'hsl(205, 95%, 60%)'} // 悬停效果
                  onMouseOut={(e) => e.currentTarget.style.background = vibrantBlue} // 恢复原状
                >
                  Manage Space
                </Button>
              </Flex>
            </Card>
          ))}
        </Grid>
      ) : (
        <Flex justify="center" align="center" style={{
          minHeight: '300px',
          border: `1px dashed ${subtleBlueGray}`,
          borderRadius: 'var(--radius-3)',
          background: 'rgba(10, 25, 47, 0.3)', // 半透明背景
        }}>
          <Text color="gray" size="3" style={{ color: subtleBlueGray }}>
            You haven't created any spaces yet.
          </Text>
        </Flex>
      )}
    </Box>
  );
}
