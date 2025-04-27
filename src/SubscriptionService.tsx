// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Card, Flex, Text, Heading, Avatar, Separator, Box } from '@radix-ui/themes'; // Import Box
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useNetworkVariable } from './networkConfig';
import { getObjectExplorerLink } from './utils';
// 使用 lucide-react 的图标，假设已安装
import { Waves, Link2Icon, Droplets, Clock, Users } from 'lucide-react';

export interface Service {
  id: string;
  fee: number;
  ttl: number;
  owner: string;
  name: string;
}

interface AllowlistProps {
  setRecipientAllowlist: React.Dispatch<React.SetStateAction<string>>;
  setCapId: React.Dispatch<React.SetStateAction<string>>;
}

export function Service({ setRecipientAllowlist, setCapId }: AllowlistProps) {
  const suiClient = useSuiClient();
  const packageId = useNetworkVariable('packageId');
  const currentAccount = useCurrentAccount();
  const [service, setService] = useState<Service>();
  const { id } = useParams();

  useEffect(() => {
    async function getService() {
      // load the service for the given id
      const service = await suiClient.getObject({
        id: id!,
        options: { showContent: true },
      });
      const fields = (service.data?.content as { fields: any })?.fields || {};
      setService({
        id: id!,
        fee: fields.fee,
        ttl: fields.ttl,
        owner: fields.owner,
        name: fields.name,
      });
      setRecipientAllowlist(id!);

      // load all caps
      const res = await suiClient.getOwnedObjects({
        owner: currentAccount?.address!,
        options: {
          showContent: true,
          showType: true,
        },
        filter: {
          StructType: `${packageId}::subscription::Cap`,
        },
      });

      // find the cap for the given service id
      const capId = res.data
        .map((obj) => {
          const fields = (obj!.data!.content as { fields: any }).fields;
          // 添加空值检查
          if (!fields || !fields.id || !fields.service_id) {
            console.warn('Skipping cap object with missing fields:', obj);
            return null;
          }
          return {
            id: fields.id.id,
            service_id: fields.service_id,
          };
        })
        .filter(item => item !== null && item.service_id === id) // 确保过滤掉 null
        .map((item) => item!.id) as string[]; // 使用非空断言
      if (capId.length > 0) {
        setCapId(capId[0]);
      } else {
        console.warn(`No Cap found for service ID: ${id}`);
        // 可以选择设置一个默认值或空字符串，或者保持不变
        // setCapId('');
      }
    }

    // Call getService immediately
    getService();

    // Set up interval to call getService every 3 seconds
    const intervalId = setInterval(() => {
      getService();
    }, 3000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [id, currentAccount?.address, packageId, suiClient, setRecipientAllowlist, setCapId]); // 添加依赖项

  // 将 TTL（毫秒）转换为分钟的函数
  const formatTtlInMinutes = (ttlMs: number | undefined): string => {
    if (typeof ttlMs !== 'number' || isNaN(ttlMs) || ttlMs <= 0) return 'N/A';
    return `${Math.floor(ttlMs / (60 * 1000))} 分钟`;
  };

  return (
    // 整体背景：更柔和的水蓝色渐变
    <Flex direction="column" gap="5" align="center" style={{ paddingTop: '3rem', paddingBottom: '3rem', background: 'linear-gradient(180deg, #e0f7fa 0%, #caf0f8 50%, #ffffff 100%)', minHeight: 'calc(100vh - 80px)' /* 假设导航栏高度 */ }}>

      {/* 创作者信息区域 */}
      <Flex direction="column" align="center" gap="2" mb="4">
        <Avatar
          size="7" // 稍微增大头像
          fallback={service?.name ? service.name[0].toUpperCase() : 'C'}
          color="cyan"
          radius="full"
          // src="/placeholder-avatar.png" // 如果有真实头像则取消注释
          style={{
            border: '4px solid white', // 白色边框增加对比
            boxShadow: '0 0 15px rgba(77, 208, 225, 0.6)', // 更明显的水波纹光晕效果
            background: 'linear-gradient(135deg, #80deea, #4dd0e1)', // 头像背景渐变
            color: '#004d40', // 深色文字确保可读性
            fontWeight: 'bold',
          }}
        />
        {/* 标题：使用更深的青色 */}
        <Heading size="6" style={{ color: '#006064', marginTop: '0.5rem' }}>{service?.name || '创作者页面'}</Heading>
        {/* 服务ID：更柔和的灰色 */}
        <Text size="2" style={{ color: '#00796b' }}>
          (服务 ID: {service?.id ? getObjectExplorerLink(service.id, true) : '加载中...'})
        </Text>
      </Flex>

      {/* 主卡片：增强水面效果 */}
      <Card style={{
        maxWidth: '650px', // 稍微加宽
        width: '90%',
        background: 'rgba(255, 255, 255, 0.85)', // 稍微提高不透明度
        backdropFilter: 'blur(10px)', // 增强毛玻璃效果
        borderRadius: '20px', // 更大的圆角
        boxShadow: '0 8px 30px rgba(0, 121, 107, 0.15)', // 更柔和、扩散的阴影
        border: '1px solid rgba(173, 232, 244, 0.7)', // #ade8f4 边框颜色
        overflow: 'hidden', // 确保内部元素不溢出
      }}>
        <Flex direction="column" gap="4" p="4"> {/* 增加内边距 */}
          {/* 标题：居中，深水鸭色 */}
          <Heading size="5" style={{ color: '#004d40', textAlign: 'center' }}>会员内容管理</Heading>

          {/* 波浪形分隔线 */}
          <Box style={{ height: '20px', width: '100%', background: 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 12.5 0, 25 5 T 50 5 T 75 5 T 100 5" fill="none" stroke="%234dd0e1" stroke-width="2"/></svg>\') center/100% 10px repeat-x', opacity: 0.6 }} />

          {/* 分享链接部分 */}
          <Flex direction="column" gap="1">
            <Text size="3" weight="medium" style={{ color: '#00695c' }}>
              <Link2Icon style={{ marginRight: '6px', verticalAlign: 'middle', color: '#0097a7' }} />
              分享页面:
            </Text>
            {/* 修改此处的 Text 组件 */}
            <Text size="2" color="gray" style={{ wordBreak: 'break-all', paddingLeft: '26px', color: '#00695c' }}> {/* 对齐图标，并设置更深的颜色 */}
              邀请支持者订阅：
              <a
                href={`${window.location.origin}/subscription-example/view/service/${service?.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#00acc1', textDecoration: 'none', fontWeight: '500', marginLeft: '5px', display: 'block', marginTop: '4px' }} // 链接样式调整
                onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                aria-label="分享订阅链接"
              >
                {`${window.location.origin}/subscription-example/view/service/${service?.id}`}
              </a>
            </Text>
          </Flex>

          {/* 另一个波浪分隔线 */}
          <Box style={{ height: '20px', width: '100%', background: 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 12.5 10, 25 5 T 50 5 T 75 5 T 100 5" fill="none" stroke="%234dd0e1" stroke-width="2"/></svg>\') center/100% 10px repeat-x', opacity: 0.6 }} />

          {/* 当前设置 */}
          <Heading size="4" style={{ color: '#004d40' }}>当前会员设置</Heading>
          {/* 将 gap 调整为 3 以容纳更多元素，或者根据需要调整 */}
          <Flex direction={{ initial: 'column', sm: 'row' }} gap="3" justify="stretch" align="center"> {/* 响应式布局, 调整 gap */}
            {/* 信息块：水滴/鹅卵石效果 - 会员有效期 */}
            <Flex direction="column" align="center" style={{ flex: 1, width: '100%', background: 'linear-gradient(145deg, rgba(224, 247, 250, 0.7), rgba(173, 232, 244, 0.5))', padding: '15px', borderRadius: '12px', border: '1px solid rgba(144, 224, 239, 0.6)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 121, 107, 0.15)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <Clock size={20} color="#00796b" style={{ marginBottom: '8px' }} />
              <Text size="2" style={{ color: '#006064' }}>会员有效期</Text>
              <Text size="5" weight="bold" style={{ color: '#004d40', marginTop: '4px' }}>
                {formatTtlInMinutes(service?.ttl)}
              </Text>
            </Flex>
            {/* 信息块：水滴/鹅卵石效果 - 订阅费用 */}
            <Flex direction="column" align="center" style={{ flex: 1, width: '100%', background: 'linear-gradient(145deg, rgba(224, 247, 250, 0.7), rgba(173, 232, 244, 0.5))', padding: '15px', borderRadius: '12px', border: '1px solid rgba(144, 224, 239, 0.6)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 121, 107, 0.15)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <Droplets size={20} color="#00796b" style={{ marginBottom: '8px' }} />
              <Text size="2" style={{ color: '#006064' }}>订阅费用 (MIST)</Text>
              <Text size="5" weight="bold" style={{ color: '#004d40', marginTop: '4px' }}>
                {service?.fee ?? 'N/A'}
              </Text>
            </Flex>
            {/* 新增：信息块：水滴/鹅卵石效果 - 关注人数 */}
            <Flex direction="column" align="center" style={{ flex: 1, width: '100%', background: 'linear-gradient(145deg, rgba(224, 247, 250, 0.7), rgba(173, 232, 244, 0.5))', padding: '15px', borderRadius: '12px', border: '1px solid rgba(144, 224, 239, 0.6)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 121, 107, 0.15)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <Users size={20} color="#00796b" style={{ marginBottom: '8px' }} />
              <Text size="2" style={{ color: '#006064' }}>关注人数</Text>
              <Text size="5" weight="bold" style={{ color: '#004d40', marginTop: '4px' }}>
                {'N/A'} {/* 替换为实际的关注人数变量 */}
              </Text>
            </Flex>
          </Flex>
          {/* 可以在底部添加一个波浪图标点缀 */}
          <Flex justify="center" mt="2">
            <Waves size={28} color="#4dd0e1" strokeWidth={1.5} opacity={0.7} />
          </Flex>
        </Flex>
      </Card>
    </Flex>
  );
}
