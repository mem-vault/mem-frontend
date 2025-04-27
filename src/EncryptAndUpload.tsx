// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
import React, { useState } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { useNetworkVariable } from './networkConfig';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Button, Card, Flex, Spinner, Text, Heading, Separator, Box } from '@radix-ui/themes';
import { getAllowlistedKeyServers, SealClient } from '@mysten/seal';
import { fromHex, toHex } from '@mysten/sui/utils';
import { UploadIcon, Link2Icon } from '@radix-ui/react-icons';
import { Droplet, Waves } from 'lucide-react';

export type Data = {
  status: string;
  blobId: string;
  endEpoch: string;
  suiRefType: string;
  suiRef: string;
  suiBaseUrl: string;
  blobUrl: string;
  suiUrl: string;
  isImage: string;
};

interface WalrusUploadProps {
  policyObject: string;
  cap_id: string;
  moduleName: string;
}

type WalrusService = {
  id: string;
  name: string;
  publisherUrl: string;
  aggregatorUrl: string;
};

export function WalrusUpload({ policyObject, cap_id, moduleName }: WalrusUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<Data | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<string>('service1');

  const SUI_VIEW_TX_URL = `https://suiscan.xyz/testnet/tx`;
  const SUI_VIEW_OBJECT_URL = `https://suiscan.xyz/testnet/object`;

  const NUM_EPOCH = 1;
  const packageId = useNetworkVariable('packageId');
  const suiClient = useSuiClient();
  const client = new SealClient({
    suiClient,
    serverObjectIds: getAllowlistedKeyServers('testnet'),
    verifyKeyServers: false,
  });

  const services: WalrusService[] = [
    {
      id: 'service1',
      name: 'Aqua Storage Hub (walrus.space)',
      publisherUrl: '/publisher1',
      aggregatorUrl: '/aggregator1',
    },
    {
      id: 'service2',
      name: 'DeepSea Cache (staketab.org)',
      publisherUrl: '/publisher2',
      aggregatorUrl: '/aggregator2',
    },
    {
      id: 'service3',
      name: 'redundex.com',
      publisherUrl: '/publisher3',
      aggregatorUrl: '/aggregator3',
    },
    {
      id: 'service4',
      name: 'nodes.guru',
      publisherUrl: '/publisher4',
      aggregatorUrl: '/aggregator4',
    },
    {
      id: 'service5',
      name: 'banansen.dev',
      publisherUrl: '/publisher5',
      aggregatorUrl: '/aggregator5',
    },
    {
      id: 'service6',
      name: 'Oceanic Vault (everstake.one)',
      publisherUrl: '/publisher6',
      aggregatorUrl: '/aggregator6',
    },
  ];

  function getAggregatorUrl(path: string): string {
    const service = services.find((s) => s.id === selectedService);
    const cleanPath = path.replace(/^\/+/, '').replace(/^v1\//, '');
    return `${service?.aggregatorUrl}/v1/${cleanPath}`;
  }

  function getPublisherUrl(path: string): string {
    const service = services.find((s) => s.id === selectedService);
    const cleanPath = path.replace(/^\/+/, '').replace(/^v1\//, '');
    return `${service?.publisherUrl}/v1/${cleanPath}`;
  }

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

  const handleFileChange = (event: any) => {
    const file = event.target.files[0];
    if (file.size > 10 * 1024 * 1024) {
      alert('文件大小不能超过 10 MiB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('仅允许上传图片文件');
      return;
    }
    setFile(file);
    setInfo(null);
  };

  const handleSubmit = () => {
    setIsUploading(true);
    if (file) {
      const reader = new FileReader();
      reader.onload = async function (event) {
        if (event.target && event.target.result) {
          const result = event.target.result;
          if (result instanceof ArrayBuffer) {
            const nonce = crypto.getRandomValues(new Uint8Array(5));
            const policyObjectBytes = fromHex(policyObject);
            const id = toHex(new Uint8Array([...policyObjectBytes, ...nonce]));
            const { encryptedObject: encryptedBytes } = await client.encrypt({
              threshold: 2,
              packageId,
              id,
              data: new Uint8Array(result),
            });
            try {
              const storageInfo = await storeBlob(encryptedBytes);
              displayUpload(storageInfo.info, file.type);
            } catch (error) {
              console.error('Error storing blob:', error);
            } finally {
              setIsUploading(false);
            }
          } else {
            console.error('Unexpected result type:', typeof result);
            setIsUploading(false);
          }
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      console.error('No file selected');
      setIsUploading(false);
    }
  };

  const displayUpload = (storage_info: any, media_type: any) => {
    let info;
    if ('alreadyCertified' in storage_info) {
      info = {
        status: '已认证',
        blobId: storage_info.alreadyCertified.blobId,
        endEpoch: storage_info.alreadyCertified.endEpoch,
        suiRefType: '之前的 Sui 认证事件',
        suiRef: storage_info.alreadyCertified.event.txDigest,
        suiBaseUrl: SUI_VIEW_TX_URL,
        blobUrl: getAggregatorUrl(`/v1/blobs/${storage_info.alreadyCertified.blobId}`),
        suiUrl: `${SUI_VIEW_TX_URL}/${storage_info.alreadyCertified.event.txDigest}`,
        isImage: media_type.startsWith('image'),
      };
    } else if ('newlyCreated' in storage_info) {
      info = {
        status: '新创建',
        blobId: storage_info.newlyCreated.blobObject.blobId,
        endEpoch: storage_info.newlyCreated.blobObject.storage.endEpoch,
        suiRefType: '关联的 Sui 对象',
        suiRef: storage_info.newlyCreated.blobObject.id,
        suiBaseUrl: SUI_VIEW_OBJECT_URL,
        blobUrl: getAggregatorUrl(`/v1/blobs/${storage_info.newlyCreated.blobObject.blobId}`),
        suiUrl: `${SUI_VIEW_OBJECT_URL}/${storage_info.newlyCreated.blobObject.id}`,
        isImage: media_type.startsWith('image'),
      };
    } else {
      console.error('Unhandled successful response:', storage_info);
      alert('处理上传响应时出错。');
      return;
    }
    setInfo(info);
  };

  const storeBlob = async (encryptedData: Uint8Array) => {
    try {
      const response = await fetch(`${getPublisherUrl(`/v1/blobs?epochs=${NUM_EPOCH}`)}`, {
        method: 'PUT',
        body: encryptedData,
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error publishing blob: ${response.status} ${response.statusText}`, errorText);
        alert(`在 Walrus 上发布内容时出错 (${response.status})，请尝试选择其他服务或稍后再试。\n详情: ${errorText.substring(0, 100)}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const info = await response.json();
      return { info };
    } catch (error) {
      console.error('Network or fetch error storing blob:', error);
      if (!(error instanceof Error && error.message.startsWith('HTTP error!'))) {
        alert('存储内容时发生网络错误，请检查您的连接或稍后再试。');
      }
      throw error;
    }
  };

  async function handlePublish(wl_id: string, cap_id: string, moduleName: string) {
    if (!info) {
      alert('没有可发布的内容信息。请先上传。');
      return;
    }
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::${moduleName}::publish`,
      arguments: [tx.object(wl_id), tx.object(cap_id), tx.pure.string(info.blobId)],
    });

    tx.setGasBudget(10000000);
    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: (result) => {
          console.log('Publish successful:', result);
          alert('内容已成功关联到您的列表！');
        },
        onError: (error) => {
          console.error('Error publishing transaction:', error);
          alert(`发布交易失败: ${error.message}`);
        },
      },
    );
  }

  return (
    <Card
      style={{
        background: 'linear-gradient(160deg, rgba(224, 247, 250, 0.8) 0%, rgba(173, 232, 244, 0.7) 100%)',
        borderRadius: '16px',
        boxShadow: '0 6px 18px rgba(0, 121, 107, 0.15)',
        border: '1px solid rgba(144, 224, 239, 0.5)',
        backdropFilter: 'blur(8px)',
        padding: '20px 24px',
      }}
    >
      <Flex direction="column" gap="5" align="stretch">
        <Heading size="6" style={{ color: '#006064', textAlign: 'center', fontWeight: 'bold' }}>
          <Droplet style={{ marginRight: '10px', verticalAlign: 'middle', color: '#00acc1' }} />
          发布独家内容
        </Heading>

        <Flex direction="column" gap="2">
          <Text size="3" weight="medium" style={{ color: '#00796b' }}>选择可见性层级:</Text>
          <Flex gap="3" align="center">
            <Button size="2" variant="soft" color="cyan" radius="full">所有支持者</Button>
            <Button size="2" variant="outline" color="gray" radius="full">特定层级 (暂不可用)</Button>
          </Flex>
        </Flex>

        <Box style={{ textAlign: 'center', color: '#4dd0e1', margin: '10px 0' }}>
          <Waves size={32} strokeWidth={1.5} />
        </Box>

        <Flex direction="column" gap="2">
          <Text size="3" weight="medium" style={{ color: '#00796b' }}>选择内容分发网络 (CDN):</Text>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            aria-label="选择内容分发网络"
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #80deea',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              color: '#00796b',
              fontSize: '14px',
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: `url('data:image/svg+xml;utf8,<svg fill="%2300796b" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>')`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
              backgroundSize: '20px',
            }}
          >
            {services.map((service) => (
              <option key={service.id} value={service.id} style={{ backgroundColor: 'white', color: '#00796b' }}>
                {service.name}
              </option>
            ))}
          </select>
        </Flex>

        <Flex direction="column" gap="3" align="center">
          {file && (
            <Box style={{
              width: '120px', height: '120px',
              background: 'linear-gradient(135deg, #e0f7fa, #b2ebf2)',
              borderRadius: '12px',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#00796b', marginBottom: '15px',
              border: '1px dashed #80deea',
              overflow: 'hidden',
            }}>
              <img src={URL.createObjectURL(file)} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }} />
            </Box>
          )}
          <label htmlFor="file-upload" style={{
            cursor: 'pointer', padding: '12px 20px', backgroundColor: 'rgba(255, 255, 255, 0.9)',
            color: '#00796b', borderRadius: '25px',
            border: '1px solid #4dd0e1',
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
            boxShadow: '0 2px 5px rgba(0, 121, 107, 0.1)',
          }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#e0f7fa'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 121, 107, 0.15)'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)'; e.currentTarget.style.boxShadow = '0 2px 5px rgba(0, 121, 107, 0.1)'; }}
          >
            <UploadIcon width="18" height="18" />
            {file ? `已选择: ${file.name}` : '选择图片上传'}
          </label>
          <input
            id="file-upload"
            type="file"
            onChange={handleFileChange}
            accept="image/*"
            aria-label="选择要上传的文件"
            style={{ display: 'none' }}
          />
          <Text size="1" style={{ color: '#00838f', fontStyle: 'italic' }}>
            最大 10 MiB, 仅支持图片格式。
          </Text>
        </Flex>

        <Button
          onClick={handleSubmit}
          disabled={!file || isUploading}
          size="3"
          style={{
            background: 'linear-gradient(to right, #26c6da, #00acc1)',
            color: 'white',
            borderRadius: '8px',
            boxShadow: '0 3px 8px rgba(0, 150, 136, 0.2)',
            fontWeight: '500',
            padding: '10px 0',
            cursor: (!file || isUploading) ? 'not-allowed' : 'pointer',
            opacity: (!file || isUploading) ? 0.6 : 1,
            transition: 'opacity 0.3s ease, background 0.3s ease',
          }}
          aria-label="加密并上传内容"
        >
          <UploadIcon style={{ marginRight: '8px' }} />
          第一步: 加密并上传
        </Button>

        {isUploading && (
          <Flex align="center" justify="center" gap="2" style={{ color: '#00796b', padding: '15px 0' }}>
            <Spinner size="3" style={{ color: '#00acc1' }} aria-label="上传中" />
            <Text size="2" weight="medium">正在安全上传至 CDN... (请稍候)</Text>
          </Flex>
        )}

        {info && file && (
          <Card variant="surface" style={{
            backgroundColor: 'rgba(255, 255, 255, 0.75)',
            borderRadius: '12px',
            backdropFilter: 'blur(5px)',
            border: '1px solid rgba(178, 235, 242, 0.6)',
          }}>
            <Flex direction="column" gap="2" p="4">
              <Heading size="4" style={{ color: '#006064', marginBottom: '5px' }}>上传详情</Heading>
              <Flex direction="column" gap="2" style={{ fontSize: '14px', color: '#00796b' }}>
                <Flex justify="between"><Text weight="medium">状态:</Text> <Text>{info.status}</Text></Flex>
                <Separator size="4" my="1" style={{ backgroundColor: 'rgba(178, 235, 242, 0.8)' }} />
                <Flex justify="between" align="center">
                  <Text weight="medium">加密内容:</Text>
                  <a
                    href={info.blobUrl}
                    style={{ color: '#004d40', textDecoration: 'none', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="在新标签页打开加密内容链接"
                  >
                    查看/下载 <Link2Icon width="14" height="14" />
                  </a>
                </Flex>
                <Separator size="4" my="1" style={{ backgroundColor: 'rgba(178, 235, 242, 0.8)' }} />
                <Flex justify="between" align="center">
                  <Text weight="medium">链上凭证:</Text>
                  <a
                    href={info.suiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#004d40', textDecoration: 'none', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    aria-label="查看链上对象或交易详情"
                  >
                    查看详情 <Link2Icon width="14" height="14" />
                  </a>
                </Flex>
              </Flex>
            </Flex>
          </Card>
        )}

        <Button
          onClick={() => handlePublish(policyObject, cap_id, moduleName)}
          disabled={!info || !file || policyObject === '' || isUploading}
          size="3"
          style={{
            background: 'linear-gradient(to right, #00796b, #00897b)',
            color: 'white',
            borderRadius: '8px',
            boxShadow: '0 3px 8px rgba(0, 121, 107, 0.2)',
            fontWeight: '500',
            padding: '10px 0',
            cursor: (!info || !file || policyObject === '' || isUploading) ? 'not-allowed' : 'pointer',
            opacity: (!info || !file || policyObject === '' || isUploading) ? 0.6 : 1,
            transition: 'opacity 0.3s ease, background 0.3s ease',
            marginTop: '10px',
          }}
          aria-label="将内容发布给支持者"
        >
          <Link2Icon style={{ marginRight: '8px' }} />
          第二步: 发布给支持者
        </Button>
      </Flex>
    </Card>
  );
}

export default WalrusUpload;
