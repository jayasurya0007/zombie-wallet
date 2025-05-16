import { gql } from '@apollo/client';
import { ZOMBIE_WALLET_TYPE} from '@/config/constants'; 

// queries.ts
export const GET_ZOMBIE_WALLETS_BY_OWNER = gql`
  query GetZombieWalletsByOwner($ownerAddress: String!) {
    objects(
      filter: {
        type: "${ZOMBIE_WALLET_TYPE}",
        owner: $ownerAddress
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
          owner {
            __typename
            ... on AddressOwner {
              owner {
                address
              }
            }
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
          }
        }
      }
    }
  }
`;


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

// queries.ts
export interface ZombieWallet {
  asMoveObject: {
    address: string;
    contents: WalletContents;
    owner: {
      __typename: string;
      owner?: {
        address: string;
      };
    };
    dynamicFields: {
      nodes: DynamicField[];
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