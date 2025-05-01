// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
// 用到了，用于创建space

import { Transaction } from '@mysten/sui/transactions';
import { Button, Card, Flex, Heading, TextField, Text, Box } from '@radix-ui/themes'; // Import Box for potential styling wrappers
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useState } from 'react';
import { useNetworkVariable } from './networkConfig';
import { useNavigate } from 'react-router-dom';

// Define some theme colors (ideally move these to a theme file)
const deepBlueBlack = '#0A101A';
const accentBlue = '#0A84FF';
const subtleBlueGray = '#55667D';
const lightText = '#E1E1E6';
const inputBg = 'rgba(40, 40, 60, 0.5)';
const placeholderBlue = '#509BFF';

export function CreateSpace() {
  const [price, setPrice] = useState('');
  const [ttl, setTtl] = useState(''); // Store TTL in minutes
  const [name, setName] = useState('');
  const packageId = useNetworkVariable('packageId');
  const suiClient = useSuiClient();
  const navigate = useNavigate();
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

  function createService(priceStr: string, ttlStr: string, nameStr: string) {
    const priceNum = parseInt(priceStr);
    const ttlNum = parseInt(ttlStr); // TTL in minutes

    if (!nameStr || isNaN(priceNum) || priceNum <= 0 || isNaN(ttlNum) || ttlNum <= 0) {
      alert('Please fill in all fields with valid numbers (Price and Duration must be positive).');
      return;
    }

    const ttlMs = ttlNum * 60 * 1000; // Convert minutes to milliseconds for the contract
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::subscription::create_service_entry`,
      arguments: [tx.pure.u64(priceNum), tx.pure.u64(ttlMs), tx.pure.string(nameStr)],
    });
    tx.setGasBudget(10000000);

    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async (result) => {
          console.log('Successfully created space:', result);
          const subscriptionObject = result.effects?.created?.find(
            (item) => item.owner && typeof item.owner === 'object' && 'Shared' in item.owner,
          );
          const createdObjectId = subscriptionObject?.reference?.objectId;

          if (createdObjectId) {
            // Generate random avatar URL
            const randomAvatarId = Math.floor(Math.random() * 70) + 1; // Pravatar has images 1-70
            const avatarUrl = `https://i.pravatar.cc/150?img=${randomAvatarId}`;

            // Store details in localStorage
            const newSpaceData = {
              id: createdObjectId, // Store ID as well if needed later
              name: nameStr,
              price: priceNum, // Store the number
              duration: ttlNum, // Store duration in minutes
              avatarUrl: avatarUrl,
            };
            localStorage.setItem('newlyCreatedSpaceData', JSON.stringify(newSpaceData));

            // Navigate back to home page
            navigate('/');
          } else {
            console.error('Could not find created object ID in transaction effects.');
            alert('Space created, but failed to get its ID. Navigating home.');
            navigate('/');
          }
        },
        onError: (error) => {
          console.error('Error creating space:', error);
          alert(`Failed to create space: ${error.message}`);
        },
      },
    );
  }

  return (
    <Flex justify="center" align="center" style={{ minHeight: '80vh', background: deepBlueBlack /* Apply base background */ }}>
      <Card style={{
        maxWidth: '450px', // Slightly wider for better spacing
        width: '100%',
        background: `linear-gradient(180deg, #0D1B2A 0%, ${deepBlueBlack} 100%)`, // Subtle gradient
        borderRadius: '16px', // More pronounced rounding
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)', // Softer, deeper shadow
        padding: '32px', // More padding
        border: `1px solid ${subtleBlueGray}` // Subtle border
      }}>
        <Heading as="h2" size="7" mb="5" align="center" style={{ color: lightText, fontWeight: 600 }}>
          Create Your Space
        </Heading>
        <Flex direction="column" gap="4"> {/* Increased gap */}
          <label>
            <Text as="div" size="2" mb="1" weight="bold" style={{ color: subtleBlueGray }}>
              Space Name:
            </Text>
            <TextField.Root
              placeholder="Name your digital ocean..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                background: inputBg,
                color: lightText,
                borderRadius: '8px',
                border: '1px solid transparent', // Hide default border
                padding: '10px 12px', // Adjust padding
              }}
            />
          </label>
          <label>
            <Text as="div" size="2" mb="1" weight="bold" style={{ color: subtleBlueGray }}>
              Subscription Price (MIST):
            </Text>
            <TextField.Root
              type="number"
              placeholder="e.g., 1000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={{
                background: inputBg,
                color: lightText,
                borderRadius: '8px',
                border: '1px solid transparent',
                padding: '10px 12px',
              }}
            />
          </label>
          <label>
            <Text as="div" size="2" mb="1" weight="bold" style={{ color: subtleBlueGray }}>
              Duration (minutes):
            </Text>
            <TextField.Root
              type="number"
              placeholder="e.g., 60"
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
              style={{
                background: inputBg,
                color: lightText,
                borderRadius: '8px',
                border: '1px solid transparent',
                padding: '10px 12px',
              }}
            />
          </label>
          <Flex direction="row" gap="3" justify="end" mt="5"> {/* Increased margin-top */}
            <Button
              size="3"
              onClick={() => createService(price, ttl, name)}
              style={{
                background: `linear-gradient(to bottom, ${accentBlue}, #0066CC)`, // Blue gradient
                color: 'white',
                borderRadius: '8px',
                padding: '10px 20px',
                fontWeight: 500,
                boxShadow: `0 4px 15px rgba(10, 132, 255, 0.3)`, // Subtle blue glow
                transition: 'transform 0.2s ease, background 0.2s ease', // Smooth transition
              }}
            >
              Launch Space
            </Button>
          </Flex>
        </Flex>
      </Card>
    </Flex>
  );
}
