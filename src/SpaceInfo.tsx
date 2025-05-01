// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
// 用到了，是查看页面
import React, { useEffect, useState } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSignPersonalMessage,
  useSuiClient,
} from '@mysten/dapp-kit';
import { useNetworkVariable } from './networkConfig';
import {
  AlertDialog,
  Avatar,
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Grid,
  Heading,
  Link as RadixLink,
  Text,
  Spinner,
} from '@radix-ui/themes';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex, SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils';
import { SealClient, SessionKey, getAllowlistedKeyServers } from '@mysten/seal';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { downloadAndDecrypt, getObjectExplorerLink, MoveCallConstructor } from './utils';
import { ExternalLinkIcon, Link1Icon, TwitterLogoIcon, InfoCircledIcon } from '@radix-ui/react-icons';

const TTL_MIN = 10;

// --- UI Theme Colors ---
const primaryBg = '#0A101A';
const secondaryBg = '#101828';
const cardBg = 'rgba(16, 24, 40, 0.8)';
const accentBlue = '#0A84FF';
const subtleBlue = '#34AADC';
const primaryText = '#F0F4F8';
const secondaryText = '#A0AEC0';
const borderColor = 'rgba(10, 132, 255, 0.3)';
const errorColor = '#FF6B6B';

export interface FeedData {
  id: string;
  fee: string;
  ttl: string;
  owner: string;
  name: string;
  blobIds: string[];
  subscriptionId?: string;
  avatarUrl?: string;
}

const generateAvatarUrl = (id: string): string => {
  const seed = encodeURIComponent(id);
  return `https://api.dicebear.com/8.x/pixel-art/svg?seed=${seed}&backgroundType=gradientLinear&backgroundColor=0a101a,101828`;
};

const SpaceInfo: React.FC<{ suiAddress: string }> = ({ suiAddress }) => {
  const suiClient = useSuiClient();
  const { id } = useParams<{ id: string }>();

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
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

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
    getFeed();

    const intervalId = setInterval(() => {
      if (!isActionLoading && !isSubscribing) {
        getFeed(true);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [id, suiAddress, packageId, suiClient, isActionLoading, isSubscribing]);

  async function getFeed(isBackgroundRefresh = false) {
    if (!id || !packageId) return;
    if (!isBackgroundRefresh) {
      setIsLoading(true);
    }

    try {
      const encryptedObjects = await suiClient
        .getDynamicFields({
          parentId: id,
        })
        .then((res) => res.data.map((obj) => obj.name.value as string));

      const service = await suiClient.getObject({
        id: id,
        options: { showContent: true },
      });
      const service_fields = (service.data?.content as any)?.fields;

      if (!service_fields) {
        throw new Error('Service object not found or has no fields.');
      }

      let valid_subscription_id: string | undefined = undefined;

      if (suiAddress) {
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

        const clock = await suiClient.getObject({
          id: SUI_CLOCK_OBJECT_ID,
          options: { showContent: true },
        });
        const clock_fields = (clock.data?.content as any)?.fields;
        const current_ms = parseInt(clock_fields?.timestamp_ms || '0');

        const valid_subscription = res.data
          .map((obj) => {
            const fields = (obj?.data?.content as any)?.fields;
            if (fields?.id?.id && fields?.created_at && fields?.service_id) {
              return {
                id: fields.id.id as string,
                created_at: parseInt(fields.created_at),
                service_id: fields.service_id as string,
              };
            }
            return null;
          })
          .filter((item) => item !== null && item.service_id === service_fields.id.id)
          .find((item) => {
            const ttlMs = parseInt(service_fields.ttl || '0');
            return item!.created_at + ttlMs > current_ms;
          });
        valid_subscription_id = valid_subscription?.id;
      }

      const feedData: FeedData = {
        id: service_fields.id.id,
        fee: service_fields.fee,
        ttl: service_fields.ttl,
        owner: service_fields.owner,
        name: service_fields.name,
        blobIds: encryptedObjects,
        subscriptionId: valid_subscription_id,
        avatarUrl: generateAvatarUrl(service_fields.id.id),
      };

      setFeed((prevFeed) => {
        if (JSON.stringify(prevFeed) !== JSON.stringify(feedData)) {
          return feedData;
        }
        return prevFeed;
      });
      setError(null);
    } catch (err: any) {
      console.error('Error fetching feed data:', err);
      if (!isBackgroundRefresh) {
        setError(`Failed to load space details: ${err.message}`);
        setFeed(undefined);
      }
    } finally {
      if (!isBackgroundRefresh) {
        setIsLoading(false);
      }
    }
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
    if (!currentAccount?.address) {
      setError('Please connect your wallet to subscribe.');
      return;
    }
    setIsSubscribing(true);
    setError(null);
    const address = currentAccount.address;
    const tx = new Transaction();
    tx.setGasBudget(10000000);
    tx.setSender(address);

    try {
      const coins = await suiClient.getCoins({ owner: address, coinType: '0x2::sui::SUI' });
      const suitableCoin = coins.data.find((c) => BigInt(c.balance) >= BigInt(fee));

      if (!suitableCoin) {
        setError(`Insufficient SUI balance. Need ${fee} MIST.`);
        setIsSubscribing(false);
        return;
      }

      const [coinToSend] = tx.splitCoins(tx.object(suitableCoin.coinObjectId), [tx.pure(fee)]);

      const subscription = tx.moveCall({
        target: `${packageId}::subscription::subscribe`,
        arguments: [coinToSend, tx.object(serviceId), tx.object(SUI_CLOCK_OBJECT_ID)],
      });
      tx.transferObjects([subscription], tx.pure.address(address));

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            console.log('Subscription successful:', result);
            await getFeed();
            setIsSubscribing(false);
          },
          onError: (err) => {
            console.error('Subscription failed:', err);
            setError(`Subscription failed: ${err.message}`);
            setIsSubscribing(false);
          },
        },
      );
    } catch (error: any) {
      console.error('Error preparing subscription transaction:', error);
      setError(`Subscription preparation failed: ${error.message}`);
      setIsSubscribing(false);
    }
  }

  const onView = async (
    blobIds: string[],
    serviceId: string,
    fee: number,
    subscriptionId?: string,
  ) => {
    if (!currentAccount?.address) {
      setError('Please connect your wallet to view content.');
      return;
    }
    setError(null);

    if (!subscriptionId) {
      return handleSubscribe(serviceId, fee);
    }

    setIsActionLoading(true);

    const processDecryption = async (key: SessionKey) => {
      const moveCallConstructor = constructMoveCall(packageId, serviceId, subscriptionId);
      await downloadAndDecrypt(
        blobIds,
        key,
        suiClient,
        client,
        moveCallConstructor,
        setError,
        setDecryptedFileUrls,
        setIsDialogOpen,
        setReloadKey,
      );
      setIsActionLoading(false);
    };

    if (
      currentSessionKey &&
      !currentSessionKey.isExpired() &&
      currentSessionKey.getAddress() === currentAccount.address
    ) {
      await processDecryption(currentSessionKey);
      return;
    }

    setCurrentSessionKey(null);
    const sessionKey = new SessionKey({
      address: currentAccount.address,
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
            setCurrentSessionKey(sessionKey);
            await processDecryption(sessionKey);
          },
          onError: (err) => {
            console.error('Failed to sign personal message:', err);
            setError(`Failed to sign message: ${err.message}`);
            setIsActionLoading(false);
          },
        },
      );
    } catch (error: any) {
      console.error('Error during onView process:', error);
      setError(`An unexpected error occurred: ${error.message}`);
      setIsActionLoading(false);
    }
  };

  const formatTtl = (ttlMs: string | undefined): string => {
    if (!ttlMs) return 'N/A';
    const totalMinutes = Math.floor(parseInt(ttlMs) / 60000);
    if (totalMinutes < 1) return '< 1 min';
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    if (remainingMinutes === 0) return `${hours} hr`;
    return `${hours} hr ${remainingMinutes} min`;
  };

  if (isLoading) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: '50vh', background: primaryBg }}>
        <Spinner size="large" />
        <Text color="gray" ml="3">Loading Space...</Text>
      </Flex>
    );
  }

  if (error && !feed) {
    return (
      <Flex direction="column" justify="center" align="center" style={{ minHeight: '50vh', background: primaryBg, padding: 'var(--space-5)' }}>
        <InfoCircledIcon width="40" height="40" color={errorColor} />
        <Heading size="5" mt="3" color="red">Error Loading Space</Heading>
        <Text color="gray" mt="2" align="center">{error}</Text>
        <Button mt="4" variant="soft" onClick={() => getFeed()}>
          Retry
        </Button>
      </Flex>
    );
  }

  if (!feed) {
    return <Text color="gray">Space information is currently unavailable.</Text>;
  }

  const explorerLink = getObjectExplorerLink(feed.id);

  return (
    <Box style={{ background: primaryBg, padding: 'var(--space-5)', borderRadius: 'var(--radius-4)' }}>
      <Card style={{ background: cardBg, backdropFilter: 'blur(10px)', border: `1px solid ${borderColor}` }}>
        <Flex direction="column" gap="6">
          <Grid columns={{ initial: '1', sm: '3fr 1fr' }} gap="6" align="start">
            <Flex gap="5" align="center">
              <Avatar
                src={feed.avatarUrl}
                fallback={feed.name?.charAt(0)?.toUpperCase() || 'S'}
                size="7"
                radius="full"
                style={{ border: `2px solid ${accentBlue}` }}
              />
              <Box>
                <Heading size="8" mb="1" style={{ color: primaryText }}>
                  {feed.name || 'Unnamed Space'}
                </Heading>
                <Flex align="center" gap="2" mb="2">
                  <Text size="2" style={{ color: secondaryText }}>
                    Owner: {feed.owner ? `${feed.owner.slice(0, 6)}...${feed.owner.slice(-4)}` : 'N/A'}
                  </Text>
                  {explorerLink && (
                    <RadixLink
                      href={explorerLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View on Explorer"
                      style={{ color: subtleBlue, display: 'inline-flex', alignItems: 'center' }}
                    >
                      <ExternalLinkIcon width="14" height="14" />
                    </RadixLink>
                  )}
                </Flex>
                <Flex gap="4" wrap="wrap">
                  <Text size="3" weight="medium" style={{ color: primaryText }}>
                    Price: <span style={{ color: accentBlue }}>{feed.fee || 'N/A'} MIST</span>
                  </Text>
                  <Text size="3" weight="medium" style={{ color: primaryText }}>
                    Duration: <span style={{ color: accentBlue }}>{formatTtl(feed.ttl)}</span>
                  </Text>
                </Flex>
              </Box>
            </Flex>

            <Box style={{ borderLeft: `1px solid ${borderColor}`, paddingLeft: 'var(--space-5)' }} className="social-links-section">
              <Heading size="4" mb="3" style={{ color: primaryText }}>
                Connect
              </Heading>
              <Flex direction="column" gap="2">
                <RadixLink href="#" target="_blank" rel="noopener noreferrer" size="2" style={{ color: subtleBlue }}>
                  <Flex gap="2" align="center">
                    <TwitterLogoIcon /> Twitter
                  </Flex>
                </RadixLink>
                <RadixLink href="#" target="_blank" rel="noopener noreferrer" size="2" style={{ color: subtleBlue }}>
                  <Flex gap="2" align="center">
                    <Link1Icon /> Website
                  </Flex>
                </RadixLink>
              </Flex>
            </Box>
          </Grid>

          <Card style={{ background: secondaryBg, border: `1px solid ${borderColor}` }}>
            <Heading size="5" mb="4" style={{ color: primaryText }}>
              Exclusive Content
            </Heading>
            <Flex direction="column" gap="3">
              {feed.blobIds.length === 0 ? (
                <Text style={{ color: secondaryText }}>This space is preparing its treasures. Check back soon!</Text>
              ) : (
                <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <Flex justify="start">
                    <Dialog.Trigger>
                      <Button
                        onClick={() =>
                          onView(feed.blobIds, feed.id, Number(feed.fee), feed.subscriptionId)
                        }
                        disabled={!currentAccount || isActionLoading || isSubscribing}
                        size="3"
                        style={{
                          background: `linear-gradient(145deg, ${accentBlue}, ${subtleBlue})`,
                          color: 'white',
                          fontWeight: '500',
                          boxShadow: `0 4px 15px rgba(10, 132, 255, 0.3)`,
                          transition: 'all 0.3s ease',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                        onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        {isActionLoading || isSubscribing ? (
                          <Spinner />
                        ) : currentAccount ? (
                          feed.subscriptionId ? (
                            'View Content'
                          ) : (
                            `Subscribe (${feed.fee} MIST for ${formatTtl(feed.ttl)})`
                          )
                        ) : (
                          'Connect Wallet to Access'
                        )}
                      </Button>
                    </Dialog.Trigger>
                  </Flex>
                  {decryptedFileUrls.length > 0 && (
                    <Dialog.Content
                      style={{ background: secondaryBg, border: `1px solid ${borderColor}`, color: primaryText }}
                      maxWidth="500px"
                      key={reloadKey}
                    >
                      <Dialog.Title style={{ color: primaryText }}>Retrieved Files</Dialog.Title>
                      <Dialog.Description size="2" mb="4" style={{ color: secondaryText }}>
                        Decrypted content from the space.
                      </Dialog.Description>

                      <Flex
                        direction="column"
                        gap="3"
                        style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 'var(--space-2)' }}
                      >
                        {decryptedFileUrls.map((decryptedFileUrl, index) => (
                          <Box
                            key={index}
                            style={{
                              border: `1px solid ${borderColor}`,
                              borderRadius: 'var(--radius-3)',
                              padding: 'var(--space-2)',
                              background: primaryBg,
                            }}
                          >
                            {decryptedFileUrl.match(/\.(jpeg|jpg|gif|png|svg)$/) ? (
                              <img
                                src={decryptedFileUrl}
                                alt={`Decrypted content ${index + 1}`}
                                style={{ maxWidth: '100%', display: 'block', borderRadius: 'var(--radius-2)' }}
                              />
                            ) : decryptedFileUrl.match(/\.(mp4|webm|ogg)$/) ? (
                              <video controls style={{ maxWidth: '100%', display: 'block', borderRadius: 'var(--radius-2)' }}>
                                <source src={decryptedFileUrl} />
                                Your browser does not support the video tag.
                              </video>
                            ) : (
                              <Text size="2" style={{ color: secondaryText }}>Unsupported file type or invalid URL.</Text>
                            )}
                          </Box>
                        ))}
                      </Flex>

                      <Flex gap="3" mt="4" justify="end">
                        <Dialog.Close>
                          <Button
                            variant="soft"
                            style={{ color: primaryText, background: 'rgba(255, 255, 255, 0.1)' }}
                            onClick={() => setDecryptedFileUrls([])}
                          >
                            Close
                          </Button>
                        </Dialog.Close>
                      </Flex>
                    </Dialog.Content>
                  )}
                </Dialog.Root>
              )}
            </Flex>
          </Card>
        </Flex>
      </Card>

      {error && feed && (
        <Box mt="4" p="3" style={{ background: 'rgba(255, 107, 107, 0.1)', border: `1px solid ${errorColor}`, borderRadius: 'var(--radius-3)' }}>
          <Flex gap="2" align="center">
            <InfoCircledIcon color={errorColor} />
            <Text size="2" style={{ color: errorColor }}>{error}</Text>
          </Flex>
        </Box>
      )}

      <AlertDialog.Root open={!!error && !currentAccount} onOpenChange={() => setError(null)}>
        <AlertDialog.Content style={{ background: secondaryBg, border: `1px solid ${borderColor}`, color: primaryText }} maxWidth="450px">
          <AlertDialog.Title style={{ color: primaryText }}>Action Required</AlertDialog.Title>
          <AlertDialog.Description size="2" style={{ color: secondaryText }}>
            {error}
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Action>
              <Button variant="soft" style={{ color: primaryText, background: 'rgba(255, 255, 255, 0.1)' }} onClick={() => setError(null)}>
                Close
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Box>
  );
};

export default SpaceInfo;
