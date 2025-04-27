// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
import { useEffect, useState } from 'react';
import { useSignPersonalMessage, useSuiClient } from '@mysten/dapp-kit';
import { useNetworkVariable } from './networkConfig';
import { AlertDialog, Avatar, Box, Button, Card, Dialog, Flex, Grid, Separator, Text } from '@radix-ui/themes';
import { fromHex } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { getAllowlistedKeyServers, SealClient, SessionKey } from '@mysten/seal';
import { useParams } from 'react-router-dom';
import { downloadAndDecrypt, getObjectExplorerLink, MoveCallConstructor } from './utils';
import { Droplet } from 'lucide-react';

const TTL_MIN = 10;
export interface FeedData {
  allowlistId: string;
  allowlistName: string;
  blobIds: string[];
}

function constructMoveCall(packageId: string, allowlistId: string): MoveCallConstructor {
  return (tx: Transaction, id: string) => {
    tx.moveCall({
      target: `${packageId}::allowlist::seal_approve`,
      arguments: [tx.pure.vector('u8', fromHex(id)), tx.object(allowlistId)],
    });
  };
}

const Feeds: React.FC<{ suiAddress: string }> = ({ suiAddress }) => {
  const suiClient = useSuiClient();
  const client = new SealClient({
    suiClient,
    serverObjectIds: getAllowlistedKeyServers('testnet'),
    verifyKeyServers: false,
  });
  const packageId = useNetworkVariable('packageId');

  const [feed, setFeed] = useState<FeedData>();
  const [decryptedFileUrls, setDecryptedFileUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionKey, setCurrentSessionKey] = useState<SessionKey | null>(null);
  const { id } = useParams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const { mutate: signPersonalMessage } = useSignPersonalMessage();

  useEffect(() => {
    getFeed();

    const intervalId = setInterval(() => {
      getFeed();
    }, 3000);

    return () => clearInterval(intervalId);
  }, [id, suiClient, packageId]);

  async function getFeed() {
    const allowlist = await suiClient.getObject({
      id: id!,
      options: { showContent: true },
    });
    const encryptedObjects = await suiClient
      .getDynamicFields({
        parentId: id!,
      })
      .then((res) => res.data.map((obj) => obj.name.value as string));
    const fields = (allowlist.data?.content as { fields: any })?.fields || {};
    const feedData = {
      allowlistId: id!,
      allowlistName: fields?.name || 'Creator',
      blobIds: encryptedObjects,
    };
    setFeed(feedData);
  }

  const onView = async (blobIds: string[], allowlistId: string) => {
    if (
      currentSessionKey &&
      !currentSessionKey.isExpired() &&
      currentSessionKey.getAddress() === suiAddress
    ) {
      const moveCallConstructor = constructMoveCall(packageId, allowlistId);
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
            const moveCallConstructor = await constructMoveCall(packageId, allowlistId);
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
        },
      );
    } catch (error: any) {
      console.error('Error accessing content:', error);
      setError('Failed to prepare content access. Please ensure your wallet is connected and try again.');
    }
  };

  const creatorName = feed?.allowlistName || 'AquaCreator';
  const creatorTagline = 'Sharing exclusive waves of content!';

  return (
    <Card style={{ background: 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)', padding: '0' }}>
      <Box style={{ background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 80 40\' width=\'80\' height=\'40\'%3E%3Cpath fill=\'%23a0dae0\' fill-opacity=\'0.4\' d=\'M0 40 L80 40 L80 0 L40 0 Z\'%3E%3C/path%3E%3Cpath fill=\'%2380cbc4\' fill-opacity=\'0.4\' d=\'M0 40 L40 0 L0 0 Z\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'repeat-x', backgroundPosition: 'bottom', padding: 'var(--space-4)' }}>
        <Flex gap="3" align="center">
          <Avatar
            size="4"
            radius="full"
            fallback={<Droplet color="white" />}
            color="cyan"
            style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
          />
          <Box>
            <Text as="div" size="4" weight="bold" style={{ color: '#00796b' }}>
              {creatorName}
            </Text>
            <Text as="div" size="2" color="gray">
              {creatorTagline} (ID: {feed?.allowlistId && getObjectExplorerLink(feed.allowlistId)})
            </Text>
          </Box>
        </Flex>
      </Box>
      <Separator size="4" style={{ margin: '0', backgroundColor: 'rgba(0, 121, 107, 0.2)' }} />

      <Box p="4">
        <h2 style={{ marginBottom: '1rem', color: '#00796b' }}>
          Exclusive Content Feed
        </h2>
        {feed === undefined ? (
          <Text color="gray">Loading creator's content...</Text>
        ) : (
          <Grid columns="1" gap="3">
            <Card key={feed!.allowlistId} style={{ background: 'rgba(255, 255, 255, 0.7)' }}>
              <Flex direction="column" align="start" gap="2">
                {feed!.blobIds.length === 0 ? (
                  <Text color="gray">This creator hasn't posted any exclusive content yet.</Text>
                ) : (
                  <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <Dialog.Trigger>
                      <Button color="cyan" variant="soft" onClick={() => onView(feed!.blobIds, feed!.allowlistId)}>
                        <Droplet size={16} style={{ marginRight: '4px' }} /> Access Supporter Content
                      </Button>
                    </Dialog.Trigger>
                    {decryptedFileUrls.length > 0 && (
                      <Dialog.Content maxWidth="450px" key={reloadKey}>
                        <Dialog.Title style={{ color: '#00796b' }}>Exclusive Content</Dialog.Title>
                        <Flex direction="column" gap="2" style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                          {decryptedFileUrls.map((decryptedFileUrl, index) => (
                            <Box key={index} p="2" style={{ border: '1px solid #b2ebf2', borderRadius: 'var(--radius-3)', background: '#e0f7fa' }}>
                              <img src={decryptedFileUrl} alt={`Exclusive content ${index + 1}`} style={{ maxWidth: '100%', display: 'block', borderRadius: 'var(--radius-2)' }} />
                            </Box>
                          ))}
                        </Flex>
                        <Flex gap="3" mt="4" justify="end">
                          <Dialog.Close>
                            <Button
                              variant="soft"
                              color="gray"
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
          </Grid>
        )}
      </Box>
      <AlertDialog.Root open={!!error} onOpenChange={() => setError(null)}>
        <AlertDialog.Content maxWidth="450px">
          <AlertDialog.Title>Access Issue</AlertDialog.Title>
          <AlertDialog.Description size="2">
            {error || "There was a problem accessing this content. Please ensure your wallet is connected and try again later."}
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Action>
              <Button variant="soft" color="gray" onClick={() => setError(null)}>
                Close
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Card>
  );
};

export default Feeds;
