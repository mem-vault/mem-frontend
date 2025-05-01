// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
// 用到了是上传页面的地方
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Card, Flex, Text, Heading, Box, Link as RadixLink, Grid } from '@radix-ui/themes'; // Import necessary Radix components
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useNetworkVariable } from './networkConfig';
import { getObjectExplorerLink } from './utils';
import { Link2Icon, InfoCircledIcon } from '@radix-ui/react-icons'; // Import icons

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

// --- Color Palette ---
const deepOceanBlue = 'hsl(210, 40%, 8%)'; // Dark base
const midnightBlue = 'hsl(210, 35%, 12%)'; // Slightly lighter dark
const ceruleanBlue = 'hsl(195, 80%, 55%)'; // Accent blue
const aquaBlue = 'hsl(180, 70%, 75%)'; // Lighter accent/highlight
const lightText = 'hsl(210, 15%, 95%)'; // Primary text
const subtleText = 'hsl(210, 15%, 70%)'; // Secondary text
const shadowColor = 'hsla(210, 40%, 4%, 0.3)'; // Soft shadow

export function ManageSpace({ setRecipientAllowlist, setCapId }: AllowlistProps) {
  const suiClient = useSuiClient();
  const packageId = useNetworkVariable('packageId');
  const currentAccount = useCurrentAccount();
  const [service, setService] = useState<Service>();
  const { id } = useParams();

  useEffect(() => {
    async function getService() {
      // load the service for the given id
      const serviceData = await suiClient.getObject({
        id: id!,
        options: { showContent: true },
      });
      const fields = (serviceData.data?.content as { fields: any })?.fields || {};
      setService({
        id: id!,
        fee: fields.fee,
        ttl: fields.ttl,
        owner: fields.owner,
        name: fields.name || 'Unnamed Space', // Provide default name
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
      const capIdResult = res.data
        .map((obj) => {
          const fields = (obj!.data!.content as { fields: any }).fields;
          return {
            id: fields?.id.id,
            service_id: fields?.service_id,
          };
        })
        .filter((item) => item.service_id === id)
        .map((item) => item.id) as string[];
      setCapId(capIdResult[0]);
    }

    // Call getService immediately
    getService();

    // Set up interval to call getService every 3 seconds
    const intervalId = setInterval(() => {
      getService();
    }, 3000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [id, suiClient, packageId, currentAccount, setRecipientAllowlist, setCapId]); // Added dependencies

  const serviceName = service?.name || 'Loading Space...';
  const serviceTtlMinutes = service?.ttl ? service.ttl / 60 / 1000 : 0;

  return (
    <Box
      style={{
        padding: 'var(--space-4) 0', // Add some vertical padding around the card
      }}
    >
      <Card
        style={{
          background: `linear-gradient(145deg, ${midnightBlue}, ${deepOceanBlue})`,
          borderRadius: 'var(--radius-4)', // Apple-like rounded corners
          boxShadow: `0 8px 25px ${shadowColor}`,
          border: `1px solid ${subtleText}1A`, // Subtle border
          overflow: 'hidden', // Ensure gradient doesn't bleed
          maxWidth: '700px', // Limit width for better readability
          margin: '0 auto', // Center the card
        }}
      >
        <Flex direction="column" gap="5" p="6"> {/* Increased padding and gap */}
          {/* Header Section */}
          <Flex direction="column" gap="1">
            <Text size="2" weight="medium" style={{ color: ceruleanBlue }}>
              SPACE CONTROL PANEL
            </Text>
            <Heading as="h2" size="7" style={{ color: lightText }}>
              {serviceName}
            </Heading>
            {service?.id && (
              <RadixLink
                href={getObjectExplorerLink(service.id)}
                target="_blank"
                rel="noopener noreferrer"
                size="2"
                style={{ color: subtleText, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
              >
                View on Explorer <Link2Icon width="14" height="14" />
              </RadixLink>
            )}
          </Flex>

          {/* Share Link Section */}
          <Box
            style={{
              background: `${subtleText}10`, // Slightly different background for emphasis
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-3)',
              border: `1px solid ${subtleText}20`,
            }}
          >
            <Flex align="center" gap="3">
              <InfoCircledIcon width="20" height="20" style={{ color: aquaBlue, flexShrink: 0 }} />
              <Text size="3" style={{ color: lightText }}>
                Share{' '}
                <RadixLink
                  href={`${window.location.origin}/subscription-example/view/service/${service?.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  weight="medium"
                  style={{ color: ceruleanBlue, textDecoration: 'underline', textUnderlineOffset: '3px' }}
                  aria-label="Shareable link to view this space"
                >
                  this public link
                </RadixLink>{' '}
                with users to subscribe and access content.
              </Text>
            </Flex>
          </Box>

          {/* Details Section */}
          <Grid columns={{ initial: '1', sm: '2' }} gap="4">
            <Box
              style={{
                background: `${subtleText}1A`,
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-2)',
              }}
            >
              <Text as="div" size="2" weight="medium" style={{ color: subtleText, marginBottom: 'var(--space-1)' }}>
                Subscription Duration
              </Text>
              <Text size="5" weight="bold" style={{ color: lightText }}>
                {serviceTtlMinutes > 0 ? `${serviceTtlMinutes} minutes` : 'Not Set'}
              </Text>
            </Box>
            <Box
              style={{
                background: `${subtleText}1A`,
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-2)',
              }}
            >
              <Text as="div" size="2" weight="medium" style={{ color: subtleText, marginBottom: 'var(--space-1)' }}>
                Subscription Fee
              </Text>
              <Text size="5" weight="bold" style={{ color: lightText }}>
                {service?.fee !== undefined ? `${service.fee} MIST` : 'Not Set'}
              </Text>
            </Box>
          </Grid>
        </Flex>
      </Card>
    </Box>
  );
}
