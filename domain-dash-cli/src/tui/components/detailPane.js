import React from 'react';
import { Box, Text } from 'ink';

const DetailPane = ({ domain }) => {
  if (!domain) {
    return (
      <Box>
        <Text>Select a domain to see the details.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>{domain.name}</Text>
      <Text>Status: {domain.status}</Text>
      <Text>Available: {domain.available !== null ? (domain.available ? 'Yes' : 'No') : 'Checking...'}</Text>
      <Text>Last Checked: {domain.lastChecked || 'Never'}</Text>
      <Text>Added At: {domain.addedAt}</Text>
      <Text>Extensions: {domain.extensions.join(', ')}</Text>
      {domain.error && <Text color="red">Error: {domain.error}</Text>}
    </Box>
  );
};

export default DetailPane;