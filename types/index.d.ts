import { default as Web3 } from "web3";
import { SendOptions } from "web3-eth-contract";

export interface ExtendedWeb3Client {
  transactionOptions: SendOptions;
  client: Web3;
  lastBlockNumber: number | "latest"
}

export interface Category {
  name: string;
  channelCount: number;
  id: number;
}

export class ContentChannel {
  constructor(props: ContentChannelTypes.Props);
  fetchDescription(): Promise<void>;
  setDescriptionAbi(description: string): Promise<string>;
  initContract(): Promise<void>;
  subscribeForSubscriptionHappened(onSubscriptionHappened: Function): void;
  fetchChannelId(): Promise<void>;
  //SUBSCRIPTIONS
  fetchSubscriptionCount(): Promise<void>;
  fetchPeriodTime(): Promise<void>;
  fetchUserSubTime(): Promise<void>;
  getUserSubTime(): number;
  getPeriod(): number;
  subscribeAbi(
    serializedPubKey: {
      pubKeyPrefix: boolean,
      pubKey: Array<number>
    }
  ): Promise<string>;
  setSubscriptionPriceAbi(priceInEth: string): string;
  withdrawBalanceAbi(): string;
  withdrawBalanceGas(): Promise<number>;
  fetchSubscribersWithKeys(): Promise<void>;
  //FILEUPLOADS
  getContentLabels(): Array<string>
  getSubscriberContents(): Array<Content>
  getActiveContentLabel(): string
  setActiveContentLabel(newActiveLabel: string): Promise<void>
  fetchLabelledContentIndexes(label: string): Promise<void>
  getLabelledContentIndexes(label: string): Promise<Array<number>>
  getContent(index: number): Promise<Content>
  subscribeForNewContentUploaded(onNewContentUploadHappened: Function): Promise<void>
  unsubscribeEvents(): Promise<void>
  uploadSubscriberContentAbi(
    batchedLinks: string,
    protocol: FileProtocol,
    contentType: ContentType,
    contentSummary: string,
    contentLabel: string,
  ): string
  fetchSubscriberContents(): Promise<void>
  needMoreContents(): void
  fetchContentLabels(): Promise<void>
}

// Differs from the data which can be retrieve from the contract.
export interface ContentChannelData {
  channelName: string; // also the key at the users storage array
  contentChannelAddress: string;
  subscribers?: Array<ContentChannelTypes.SubscriberData>;
  owner: string;
}

export namespace ContentChannelTypes {
  interface Props {
    web3: ExtendedWeb3Client;
    contractAddress: string;
    // initContract method fills or opt.
    purityAddress?: string
    contentCreator?: string;
    channelName?: string;
  }

  // SUBSCRIPTIONS
  export interface SubscriberData {
    address: string;
    decompressedPubKey: string;
  }

  export interface SubscriberKeys {
    pubKeyPrefix: boolean;
    pubKey: string;
  }
}

export interface Content {
  protocol: FileProtocol;
  contentType: ContentType;
  fileAddress: string;
  summary?: string;
  uploadTime: number; //timeStamp
}

export enum FileProtocol {
  DNS,
  IPFS,
  IPNS,
}

export enum ContentType {
  UNDEFINED, //can be image, video or anything that the webbroswer can open.
  WEBPAGE,
  PREMIUM = 100, //For premium contents -> always IPFS or SWARM
  ENCRYPTED_PREMIUM
}

export class Purity {

  constructor(props: PurityTypes.Props)
  getUser(): string
  fetchCategories(): Promise<void>
  needMoreCategories(): void
  resetCategories(): void
  getCategories(fromCategoryId: number, size: number): Promise<Array<Category>>
  getCategoryLength(topic: string): Promise<number>
  createContentChannelAbi(
    channel: string,
    topic: string,
    subPrice: number,
    subTimeInSeconds: number,
    permitExternalSubs: boolean,
    description: string
  ): Promise<string>
  getChannelsFromCategories(
    categoryName: string,
    fromContentChannelId?: number,
    size?: number
  ): Promise<Array<string>>
  getWithdrawFee(): Promise<number>
  getContentChannelInstance(channel: string): Promise<ContentChannel>
  initContentChannelInstanceFromAddress(address: string): Promise<ContentChannel>
}

export namespace PurityTypes {
  interface Props {
    web3: ExtendedWeb3Client;
    contractAddress: string;
  }
}

export function initPurity(
  web3: ExtendedWeb3Client,
  options?: {
    purityAddress?: string
  }
): Purity
