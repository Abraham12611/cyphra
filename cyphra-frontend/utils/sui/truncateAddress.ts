/**
 * Truncates a blockchain address for display purposes
 * @param address The full address to truncate
 * @param startChars Number of characters to show at the beginning (default: 6)
 * @param endChars Number of characters to show at the end (default: 4)
 * @returns The truncated address with ellipsis
 */
export const truncateAddress = (
  address: string | undefined | null,
  startChars: number = 6,
  endChars: number = 4
): string => {
  if (!address) return '';

  if (address.length <= startChars + endChars) {
    return address;
  }

  const start = address.substring(0, startChars);
  const end = address.substring(address.length - endChars);

  return `${start}...${end}`;
};

/**
 * Formats a Sui address with 0x prefix if not present
 * @param address The address to format
 * @returns The formatted address with 0x prefix
 */
export const formatSuiAddress = (
  address: string | undefined | null
): string => {
  if (!address) return '';

  if (!address.startsWith('0x')) {
    return `0x${address}`;
  }

  return address;
};

/**
 * Combines formatting and truncating an address
 * @param address The full address to format and truncate
 * @param startChars Number of characters to show at the beginning
 * @param endChars Number of characters to show at the end
 * @returns The formatted and truncated address
 */
export const formatAndTruncateAddress = (
  address: string | undefined | null,
  startChars: number = 6,
  endChars: number = 4
): string => {
  return truncateAddress(formatSuiAddress(address), startChars, endChars);
};
