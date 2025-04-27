// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
import { useEffect, useState } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSignPersonalMessage,
  useSuiClient,
} from '@mysten/dapp-kit';
import { useNetworkVariable } from './networkConfig';
import { AlertDialog, Button, Card, Dialog, Flex, Avatar, Heading, Text } from '@radix-ui/themes';
import { EyeOpenIcon, StarIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { coinWithBalance, Transaction } from '@mysten/sui/transactions';
import { fromHex, SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils';
import { SealClient, SessionKey, getAllowlistedKeyServers } from '@mysten/seal';
import { useParams } from 'react-router-dom';
import { downloadAndDecrypt, getObjectExplorerLink, MoveCallConstructor } from './utils';

const TTL_MIN = 10;
export interface FeedData {
  id: string;
  fee: string;
  ttl: string;
  owner: string;
  name: string;
  blobIds: string[];
  subscriptionId?: string;
}

const FeedsToSubscribe: React.FC<{ suiAddress: string }> = ({ suiAddress }) => {
  const suiClient = useSuiClient();
  const { id } = useParams();

  const client = new SealClient({
    suiClient,
    serverObjectIds: getAllowlistedKeyServers('testnet'),
    verifyKeyServers: false,
  });
  const [feed, setFeed] = useState<FeedData>();
  const [decryptedFileUrls, setDecryptedFileUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const packageId = useNetworkVariable('packageId');
  const currentAccount = useCurrentAccount();
  const [currentSessionKey, setCurrentSessionKey] = useState<SessionKey | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { mutate: signPersonalMessage } = useSignPersonalMessage();

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

  useEffect(() => {
    // Call getFeed immediately
    getFeed();

    // Set up interval to call getFeed every 3 seconds
    const intervalId = setInterval(() => {
      getFeed();
    }, 3000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [id, suiAddress, packageId, suiClient]);

  async function getFeed() {
    // get all encrypted objects for the given service id
    const encryptedObjects = await suiClient
      .getDynamicFields({
        parentId: id!,
      })
      .then((res) => res.data.map((obj) => obj.name.value as string));

    // get the current service object
    const service = await suiClient.getObject({
      id: id!,
      options: { showContent: true },
    });
    const service_fields = (service.data?.content as { fields: any })?.fields || {};

    // get all subscriptions for the given sui address
    const res = await suiClient.getOwnedObjects({
      owner: suiAddress,
      options: {
        showContent: true,
        showType: true,
      },
      filter: {
        StructType: `${packageId}::subscription::Subscription`,
      },
    });

    // get the current timestamp
    const clock = await suiClient.getObject({
      id: '0x6',
      options: { showContent: true },
    });
    const fields = (clock.data?.content as { fields: any })?.fields || {};
    const current_ms = fields.timestamp_ms;

    // find an expired subscription for the given service if exists.
    const valid_subscription = res.data
      .map((obj) => {
        const fields = (obj!.data!.content as { fields: any }).fields;
        const x = {
          id: fields?.id.id,
          created_at: parseInt(fields?.created_at),
          service_id: fields?.service_id,
        };
        return x;
      })
      .filter((item) => item.service_id === service_fields.id.id)
      .find((item) => {
        const createdAt = Number(item.created_at);
        const ttl = parseInt(service_fields.ttl);
        if (!isNaN(createdAt) && !isNaN(ttl)) {
          return createdAt + ttl > current_ms;
        }
        return false;
      });

    const feed = {
      ...service_fields,
      id: service_fields.id.id,
      blobIds: encryptedObjects,
      subscriptionId: valid_subscription?.id,
    } as FeedData;
    setFeed(feed);
  }

  function constructMoveCall(
    packageId: string,
    serviceId: string,
    subscriptionId: string,
  ): MoveCallConstructor {
    return (tx: Transaction, id: string) => {
      tx.moveCall({
        target: `${packageId}::subscription::seal_approve`,
        arguments: [
          tx.pure.vector('u8', fromHex(id)),
          tx.object(subscriptionId),
          tx.object(serviceId),
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });
    };
  }

  async function handleSubscribe(serviceId: string, fee: number) {
    const address = currentAccount?.address!;
    const tx = new Transaction();
    tx.setGasBudget(10000000);
    tx.setSender(address);
    const subscription = tx.moveCall({
      target: `${packageId}::subscription::subscribe`,
      arguments: [
        coinWithBalance({
          balance: BigInt(fee),
        }),
        tx.object(serviceId),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });
    tx.moveCall({
      target: `${packageId}::subscription::transfer`,
      arguments: [tx.object(subscription), tx.pure.address(address)],
    });

    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async (result) => {
          console.log('res', result);
          getFeed();
        },
        onError: (error) => {
          console.error("Subscription failed:", error);
          setError("订阅失败，请稍后再试。");
        }
      },
    );
  }

  const onView = async (
    blobIds: string[],
    serviceId: string,
    fee: number,
    subscriptionId?: string,
  ) => {
    if (!subscriptionId) {
      if (isNaN(fee)) {
        console.error("Invalid fee for subscription:", fee);
        setError("无法获取订阅价格，请稍后重试。");
        return;
      }
      return handleSubscribe(serviceId, fee);
    }

    setError(null);
    setDecryptedFileUrls([]);

    if (
      currentSessionKey &&
      !currentSessionKey.isExpired() &&
      currentSessionKey.getAddress() === suiAddress
    ) {
      const moveCallConstructor = constructMoveCall(packageId, serviceId, subscriptionId);
      downloadAndDecrypt(
        blobIds,
        currentSessionKey,
        suiClient,
        client,
        moveCallConstructor,
        setError,
        setDecryptedFileUrls,
        setIsDialogOpen,
        setReloadKey,
      );
      return;
    }
    setCurrentSessionKey(null);

    const sessionKey = new SessionKey({
      address: suiAddress,
      packageId,
      ttlMin: TTL_MIN,
    });

    try {
      signPersonalMessage(
        {
          message: sessionKey.getPersonalMessage(),
        },
        {
          onSuccess: async (result) => {
            await sessionKey.setPersonalMessageSignature(result.signature);
            const moveCallConstructor = await constructMoveCall(
              packageId,
              serviceId,
              subscriptionId,
            );
            await downloadAndDecrypt(
              blobIds,
              sessionKey,
              suiClient,
              client,
              moveCallConstructor,
              setError,
              setDecryptedFileUrls,
              setIsDialogOpen,
              setReloadKey,
            );
            setCurrentSessionKey(sessionKey);
          },
          onError: (error) => {
            console.error("Personal message signing failed:", error);
            setError("签名失败，无法访问内容。");
          }
        },
      );
    } catch (error: any) {
      console.error('Error setting up session key:', error);
      setError("访问内容时出错，请重试。");
    }
  };

  const formatTtlFriendly = (ttlMs: string | undefined): string => {
    if (!ttlMs) return '限时';
    const ttlNum = parseInt(ttlMs);
    if (isNaN(ttlNum) || ttlNum <= 0) return '限时';
    const minutes = Math.floor(ttlNum / (60 * 1000));
    if (minutes < 1) return '< 1 分钟';
    if (minutes < 60) return `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时`;
    const days = Math.floor(hours / 24);
    return `${days} 天`;
  };

  return (
    <Card style={{
      maxWidth: '700px',
      margin: '3rem auto',
      background: 'linear-gradient(145deg, rgba(224, 247, 250, 0.85) 0%, rgba(178, 235, 242, 0.9) 40%, rgba(128, 222, 234, 0.95) 100%)',
      borderRadius: '20px',
      boxShadow: '0 8px 25px rgba(77, 208, 225, 0.25)',
      padding: '2.5rem',
      border: '1px solid rgba(255, 255, 255, 0.5)',
      backdropFilter: 'blur(3px)',
    }}>
      {feed === undefined ? (
        <Flex justify="center" align="center" style={{ minHeight: '150px', flexDirection: 'column', gap: '1rem' }}>
          <div className="spinner"></div>
          <Text color="gray" style={{ color: '#007788' }}>正在加载创作者内容...</Text>
        </Flex>
      ) : (
        <Card key={feed!.id} style={{
          background: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(8px)',
          borderRadius: '15px',
          padding: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
        }}>
          <Flex align="center" gap="4" mb="5">
            <Avatar
              size="5"
              fallback={feed!.name ? feed!.name.charAt(0).toUpperCase() : 'C'}
              style={{ background: 'linear-gradient(135deg, #4DD0E1, #00ACC1)', color: 'white', boxShadow: '0 2px 6px rgba(0, 172, 193, 0.4)' }}
              radius="full"
              src={`https://api.dicebear.com/8.x/initials/svg?seed=${feed!.owner || 'creator'}&backgroundColor=00acc1,4dd0e1&backgroundType=gradientLinear`}
            />
            <Flex direction="column">
              <Heading size="6" style={{ color: '#006064', fontWeight: 'bold' }}>{feed!.name || '创作者的专属空间'}</Heading>
              <Text size="2" style={{ color: '#00838f' }}>
                由 {feed!.owner ? `${feed!.owner.substring(0, 6)}...${feed!.owner.substring(feed!.owner.length - 4)}` : '匿名创作者'} 发布
                (服务 ID: <a href={getObjectExplorerLink(feed!.id)} target="_blank" rel="noopener noreferrer" style={{ color: '#0097a7', textDecoration: 'none' }}>查看详情</a>)
              </Text>
            </Flex>
          </Flex>

          <Flex direction="column" gap="4">
            {feed!.blobIds.length === 0 ? (
              <Flex justify="center" align="center" style={{
                minHeight: '120px',
                border: '2px dashed rgba(128, 222, 234, 0.6)',
                borderRadius: '10px',
                padding: '1.5rem',
                background: 'rgba(224, 247, 250, 0.5)',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <InfoCircledIcon width="24" height="24" color="#0097a7" />
                <Text style={{ color: '#007c91' }}>创作者还没有发布任何内容哦~ 敬请期待！</Text>
              </Flex>
            ) : (
              <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <Flex justify="start">
                  <Dialog.Trigger asChild>
                    <Button
                      onClick={() =>
                        onView(feed!.blobIds, feed!.id, Number(feed!.fee) || 0, feed!.subscriptionId)
                      }
                      size="3"
                      variant="solid"
                      style={{
                        background: 'linear-gradient(135deg, #00bcd4, #0097a7)',
                        color: 'white',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease, box-shadow 0.3s ease, background 0.3s ease',
                        boxShadow: '0 3px 8px rgba(0, 151, 167, 0.3)',
                        padding: '0.7rem 1.5rem',
                        fontWeight: '500',
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 151, 167, 0.4)'; e.currentTarget.style.background = 'linear-gradient(135deg, #00acc1, #00838f)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 3px 8px rgba(0, 151, 167, 0.3)'; e.currentTarget.style.background = 'linear-gradient(135deg, #00bcd4, #0097a7)'; }}
                    >
                      {feed!.subscriptionId ? (
                        <>
                          <EyeOpenIcon style={{ marginRight: '6px', verticalAlign: 'middle' }} /> 查看已解锁内容
                        </>
                      ) : (
                        <>
                          <StarIcon style={{ marginRight: '6px', verticalAlign: 'middle' }} /> 订阅支持 ({feed!.fee} MIST / {formatTtlFriendly(feed!.ttl)})
                        </>
                      )}
                    </Button>
                  </Dialog.Trigger>
                </Flex>
                {decryptedFileUrls.length > 0 && (
                  <Dialog.Content maxWidth="550px" key={reloadKey} style={{
                    background: 'rgba(240, 253, 255, 0.9)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '16px',
                    boxShadow: '0 5px 20px rgba(0, 151, 167, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.7)'
                  }}>
                    <Dialog.Title style={{ color: '#006064', fontWeight: 'bold' }}>来自创作者的礼物</Dialog.Title>
                    <Flex direction="column" gap="3" mt="3" style={{ maxHeight: '450px', overflowY: 'auto', padding: '0 10px 10px 5px' }}>
                      {decryptedFileUrls.map((decryptedFileUrl, index) => (
                        <div key={index} style={{ border: '1px solid rgba(178, 235, 242, 0.8)', borderRadius: '10px', padding: '0.7rem', background: 'rgba(255, 255, 255, 0.8)' }}>
                          <img src={decryptedFileUrl} alt={`已解锁内容 ${index + 1}`} style={{ maxWidth: '100%', display: 'block', borderRadius: '6px' }} />
                        </div>
                      ))}
                    </Flex>
                    <Flex gap="3" mt="4" justify="end">
                      <Dialog.Close asChild>
                        <Button
                          variant="soft"
                          color="cyan"
                          onClick={() => setDecryptedFileUrls([])}
                          style={{ borderRadius: '10px', background: 'rgba(224, 247, 250, 0.7)', color: '#007c91' }}
                        >
                          关闭
                        </Button>
                      </Dialog.Close>
                    </Flex>
                  </Dialog.Content>
                )}
              </Dialog.Root>
            )}
          </Flex>
        </Card>
      )}
      <AlertDialog.Root open={!!error} onOpenChange={() => setError(null)}>
        <AlertDialog.Content style={{
          maxWidth: 450,
          background: 'rgba(255, 238, 238, 0.9)',
          backdropFilter: 'blur(8px)',
          borderRadius: '15px',
          border: '1px solid rgba(255, 204, 204, 0.8)',
          boxShadow: '0 4px 15px rgba(229, 115, 115, 0.2)',
        }}>
          <AlertDialog.Title style={{ color: '#b71c1c', fontWeight: 'bold' }}>操作失败</AlertDialog.Title>
          <AlertDialog.Description size="2" style={{ color: '#c62828' }}>
            {error || '发生未知错误，请稍后重试。'}
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel asChild>
              <Button variant="soft" color="gray" onClick={() => setError(null)} style={{ borderRadius: '10px', background: 'rgba(222, 222, 222, 0.7)', color: '#555' }}>
                关闭
              </Button>
            </AlertDialog.Cancel>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Card>
  );
};

export default FeedsToSubscribe;
