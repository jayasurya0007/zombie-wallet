import { gql } from '@apollo/client';
import { ZOMBIE_WALLET_TYPE } from '@/config/constants'; // Adjust the path as needed

export const GET_ZOMBIE_WALLETS = gql`
  query GetZombieWallets {
    objects(
      filter: {
        type: "${ZOMBIE_WALLET_TYPE}"
      }
      first: 10
    ) {
      nodes {
        asMoveObject {
          address
          contents {
            type {
              repr
            }
            data
          }
          dynamicFields(first: 5) {
            nodes {
              name {
                bcs
              }
              value {
                ... on MoveValue {
                  type {
                    repr
                  }
                  bcs
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }`;

// Rest of your type definitions remain the same
export interface MoveValue {
  type: {
    repr: string;
  };
  bcs: string;
}

export interface DynamicField {
  name: {
    bcs: string;
  };
  value: MoveValue;
}

export interface WalletContents {
  type: {
    repr: string;
  };
  data: {
    Struct: Array<{
      name: string;
      value: any;
    }>;
  };
}

export interface ZombieWallet {
  asMoveObject: {
    address: string;
    contents: WalletContents;
    dynamicFields: {
      nodes: DynamicField[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
}

export interface ZombieWalletData {
  objects: {
    nodes: ZombieWallet[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

export interface WalletDataStruct {
  id: {
    UID: number[];
  };
  owner: {
    Address: number[];
  };
  beneficiaries: {
    Struct: Array<{
      name: string;
      value: any;
    }>;
  };
  beneficiary_addrs: {
    Vector: Array<{
      Address: number[];
    }>;
  };
  coin: {
    Struct: Array<{
      name: string;
      value: {
        Number: string;
      };
    }>;
  };
}