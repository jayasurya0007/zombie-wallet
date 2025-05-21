import { gql } from '@apollo/client';
import { ZOMBIE_WALLET_TYPE} from '@/config/constants'; 

// queries.ts
export const GET_ALL_ZOMBIE_WALLETS = gql`
  query GetAllZombieWallets {
    objects(
      filter: { 
        type: "${ZOMBIE_WALLET_TYPE}"
      }
      first: 20
    ) {
      nodes {
        address
        owner {
          __typename
          ... on Shared {
            initialSharedVersion
          }
        }
        asMoveObject {
          contents {
            type { repr }
            json
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