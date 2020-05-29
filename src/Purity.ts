import contractAbi from "./abis/Purity";
import { ContentChannel } from "./ContentChannel";
import { ExtendedWeb3Client, Category, PurityTypes } from "../types";
import { Contract } from "web3-eth-contract";
import { Environment } from "./environments/Environment";
// import { TransactionReceipt } from "web3-core";
// import { EventEmitter } from "events";

export class Purity {

  public categories: Array<Category>;
  public hasCategoriesFetchMore: boolean;
  private web3: ExtendedWeb3Client;
  private contractAddress: string;
  private contract: Contract;
  private nextFetchCategoriesFrom: number; //catory ID where it will fetch from
  private fetchCategoriesPageSize: number;

  constructor(props: PurityTypes.Props) {
    this.web3 = props.web3;
    this.contractAddress = props.contractAddress;
    this.contract = new this.web3.client.eth.Contract(contractAbi, this.contractAddress);
    //categories fetch
    this.categories = [];
    this.hasCategoriesFetchMore = true;
    this.nextFetchCategoriesFrom = 0;
    this.fetchCategoriesPageSize = 5;
  }

  async initContract() {
  }

  getUser(): string {
    return this.web3.transactionOptions.from;
  }

  /// CATEGORIES

  async fetchCategories(): Promise<void> {
    const page: number = this.nextFetchCategoriesFrom;
    const items: number = this.fetchCategoriesPageSize;

    if(!this.hasCategoriesFetchMore) {
      return;
    }

    const categories = await this.getCategories(page, items);
    for (const category of categories) {
      if(category.channelCount == 0) {
        this.hasCategoriesFetchMore = false;
        break;
      } else {
        this.categories.push(category);
        this.nextFetchCategoriesFrom = category.id;
      }
    }
  }

  needMoreCategories(): void {
    this.nextFetchCategoriesFrom++;
  }

  resetCategories(): void {
    this.hasCategoriesFetchMore = true;
    this.nextFetchCategoriesFrom = 0;
    this.categories = [];
  }

  async getCategories(fromCategoryId: number, size: number): Promise<Array<Category>> {
    // let categoryName: Array<Array<string>>;
    // let categoryChannelCount: Array<number>;
    // let categoryIds: Array<number>;
    const result: Array<Category> = [];
    const response: {
      0: Array<string>, //category names in bytes
      1: Array<number>, //category channel creation count
      2: Array<number> //category id
    } = await this.contract.methods.getCategories(fromCategoryId, size).call(this.web3.transactionOptions);
    for (let i = 0; i < size; i++) {
      const name: string = this.web3.client.utils.toUtf8(response[0][i]);
      const channelCount: number = response[1][i];
      const channelId: number = response[2][i];
      result.push({
        name: name,
        channelCount: channelCount,
        id: channelId
      });
    }
    return result;
  }

  async getCategoryLength(topic: string): Promise<number> {
    const hexaTopic = this.web3.client.utils.fromAscii(topic);

    try {
      const response = await this.contract.methods.getCategoryLength(hexaTopic).call(this.web3.transactionOptions);
      return response;
    } catch(e) {
      console.warn(`Error at getTopicLength`, e)
      throw new Error(`Error at getTopicLength`);
    }
  }

  /// CHANNELS

  async createContentChannelAbi(
    channel: string,
    topic: string,
    subPrice: number,
    subTimeInSeconds: number,
    permitExternalSubs: boolean,
    description: string
  ): Promise<string> {
    const hexaTopic = this.web3.client.utils.utf8ToHex(topic);
    const hexaChannel = this.web3.client.utils.utf8ToHex(channel);
    const subPriceInWei = this.web3.client.utils.toWei(subPrice.toString());
    console.log("hexachannel", hexaChannel);
    console.log("hexaTopic", hexaTopic);
    console.log("subPrice", subPrice);
    console.log("description", description);
    console.log("transactionOptions", this.web3.transactionOptions);

    return this.contract.methods.createContentChannel(
      hexaChannel,
      hexaTopic,
      subPriceInWei,
      subTimeInSeconds,
      permitExternalSubs,
      description
    ).encodeABI()
  }

  /**
   * Get channels' addresses
   **/
  async getChannelsFromCategories(
    categoryName: string,
    fromContentChannelId: number = 0,
    size: number = 3
  ): Promise<Array<string>> {
    const hexaCategory = this.web3.client.utils.fromAscii(categoryName);

    const response = await this.contract.methods.getChannelsFromCategories(hexaCategory, fromContentChannelId, size).call(this.web3.transactionOptions);
    return response;
  }

  /**
   * Get how many coins will be substracted at withdrawals in percents
   **/
  async getWithdrawFee(): Promise<number> {
    return this.contract.methods.withdrawFeePercent().call(this.web3.transactionOptions);
  }

  /**
   * Get ContentChannel instance which already initialized with its all async properties
   **/
  async getContentChannelInstance(channel: string): Promise<ContentChannel> {
    const channelName = this.web3.client.utils.fromAscii(channel);
    console.log("getContentChannelInstance -> channelname", channelName);
    const channelAddress: string = await this.contract.methods.getChannelAddressFromName(channelName).call(this.web3.transactionOptions);

    if (channelAddress === "0x0000000000000000000000000000000000000000") {
      throw Error("Channel doesn't exist on PurityWeb");
    }

    const contentChannelInstance = await this.initContentChannelInstanceFromAddress(channelAddress);
    return contentChannelInstance;
  }

  async initContentChannelInstanceFromAddress(address: string): Promise<ContentChannel> {
    console.log("initChannelFromAddress", address);
    const contentChannelInstance = new ContentChannel({
      contractAddress: address,
      web3: this.web3
    });

    await contentChannelInstance.initContract();
    return contentChannelInstance;
  }

  /// USER keys
  //TODO
}

//Necessary to put into separate service because the childContracts sometimes initializate their parentContract
export function initPurity(
  web3: ExtendedWeb3Client,
  options?: {
    purityAddress?: string
  }
): Purity {
  const purityContractAddress = options && options.purityAddress
    ? options.purityAddress : Environment.purityAddress;

  const purityWeb = new Purity({
    web3: web3,
    contractAddress: purityContractAddress
  });
  return purityWeb;
}

export default Purity;
