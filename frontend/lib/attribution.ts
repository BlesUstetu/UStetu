import { Attribution } from "ox/erc8021";

/**
 * Base Builder Code for UStetu.
 * Appended per transaction through Wagmi's writeContractAsync dataSuffix option.
 */
export const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: ["bc_1oz805i4"],
});
