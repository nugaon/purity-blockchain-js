import contractAbi from "./abis/ContentChannel";
// import { default as Purity, initPurity } from "./Purity";
import { ExtendedWeb3Client, ContentType, Content, FileProtocol, ContentChannelTypes } from "../types";
import { Contract } from "web3-eth-contract";
import { unserializePublicKey } from "purity-identity";
//import { TransactionReceipt } from "web3-core";

export class ContentChannel {

  public contractAddress: string;
  public channelName: string;
  public description: string;
  public asyncInited: boolean;
  public contentCreator: string;
  public channelId: number;
  protected web3: ExtendedWeb3Client;
  protected contract: Contract;
  private activeEvents: Array<any>;
  //SUBSCRIPTIONS
  public price: string | undefined;
  public balance: string;
  public period: number | undefined; //how many seconds the user get after subscription
  public subscribers: Array<ContentChannelTypes.SubscriberData>;
  public subscriptionCount: number;
  private userSubTime: number | null; //user's premium subscription deadline -> timestamp in seconds -> only called through getter function.
  // private purity: Purity;
  //FILEUPLOADS
  public hasContentFetchMore: boolean;
  private activeContentLabel: string;
  private contentLabelIndexes: {[label: string]: Array<number>};
  private contentLabels: Array<string>;
  private subscriberContents: Array<Content>;
  private fetchContentPageSize: number;
  private nextFetchContentsPage: number;

  constructor(props: ContentChannelTypes.Props) {
    // const { purityAddress } = props;
    this.web3 = props.web3;
    this.contractAddress = props.contractAddress;
    this.contract = new this.web3.client.eth.Contract(contractAbi, this.contractAddress);
    // if all of the data passed to the constructor not necessary to call initContract method
    // this.purity = initPurity(this.web3, { purityAddress });
    this.activeEvents = [];
    // basic inits which has to be passed by props or init asyncrounosly
    this.channelName = ""
    this.description = ""
    this.asyncInited = false
    this.contentCreator = ""
    this.channelId = -1
    this.subscriptionCount = 0
    this.userSubTime = null
    //SUBSCRIPTIONS
    this.balance = "0";
    this.subscribers = [];
    //FILEUPLOADS
    this.fetchContentPageSize = 1;
    this.nextFetchContentsPage = 0;
    this.hasContentFetchMore = true;
    this.subscriberContents = [];
    this.contentLabels = ["All"]; //Every Contract has this label
    this.activeContentLabel = "All";
    this.contentLabelIndexes = {};
    if(
      typeof props.contentCreator === "string"
      && typeof props.channelName === "string"
    ) {
      this.contentCreator = props.contentCreator;
      this.channelName = props.channelName;
      this.asyncInited = true;
    }
  }

  public async fetchDescription() {
    const description = this.contract.methods.description();
    this.description = await description.call(this.web3.transactionOptions);
  }

  public async setDescriptionAbi(description: string): Promise<string> {
    return this.contract.methods.setDescription(description).encodeABI()
  }

  public async initContract() {
    const contractData = await this.getContentChannelData();
    console.log("contractData", contractData);
    this.contentCreator = contractData.contentCreator_;
    this.channelName = contractData.channelName_;
    this.channelId = contractData.channelId_;
    this.balance = contractData.balance_;
    this.price = contractData.price_;
    this.subscriptionCount = contractData.subscriptionCount_;
    this.userSubTime = contractData.userSubTime_;
    this.description = contractData.description_;

    this.asyncInited = true;
  }

  // Especially used at init
  private async getContentChannelData(): Promise<{
    contentCreator_: string,
    channelName_: string,
    description_: string,
    channelId_: number,
    balance_: string,
    price_: string,
    subscriptionCount_: number, //listing according the subscription count in the topic.
    userSubTime_: number,
  }> {
    let response: any = await this.contract.methods.getChannelData().call(this.web3.transactionOptions);
    response.channelName_ = this.web3.client.utils.hexToUtf8(response.channelName_);
    response.balance_ = this.web3.client.utils.fromWei(response.balance_);
    response.price_ = this.web3.client.utils.fromWei(response.price_);
    return response;
  }

  public async subscribeForSubscriptionHappened(onSubscriptionHappened: Function) {
    console.log("sub for SubscriptionHappened event", this.contractAddress);
    this.activeEvents.push(this.contract.events.SubscriptionHappened({
      fromBlock: this.web3.lastBlockNumber,
    }, (error: any, event: any) => {
      if (error) {
        console.log(`Error at contract event listening: ${error}`);
      }
      onSubscriptionHappened(this);
      console.log("subscription happened", event);
    }));
  }

  public async fetchChannelId() {
      this.channelId = await this.contract.methods.channelId().call(this.web3.transactionOptions);
  }

  //SUBSCRIPTIONS

  public async fetchSubscriptionCount() {
    this.subscriptionCount = await this.contract.methods.getSubscriptionCount().call(this.web3.transactionOptions);
  }

  public async fetchPeriodTime() {
    let period = this.contract.methods.period();
    this.period = await period.call(this.web3.transactionOptions);
  }

  public async fetchUserSubTime() {
    try {
      this.userSubTime = await this.contract.methods.premiumDeadlines(
        this.web3.transactionOptions.from
      ).call(this.web3.transactionOptions);
    } catch(e) {
      console.warn("fetchUserSubTime", e);
      this.userSubTime = null;
    }
  }

  /**
   * Only necessary to call at Channels initialization which the user subscribed on
   *
   * @return userSubTime in a correct timestamp format OR the current date
   **/
  public getUserSubTime(): number {
    return this.userSubTime ? this.userSubTime * 1000 : new Date().getTime()
  }

  public getPeriod(): number {
    return this.period ? this.period * 1000 : 0;
  }

  /**
   * Subscribe with the client address to the content channel
   *
   * @param subPrice in Ether
   * @param serializedPubKey throught "purity-identify" package it can be generated and handled
   **/
  public async subscribeAbi(
    serializedPubKey: {
      pubKeyPrefix: boolean,
      pubKey: Array<number>
    }
  ): Promise<string> {
    // let userPubKey = await this.purityWeb.getUserPubKey(this.web3.transactionOptions.from);
    // console.log("pubkey", userPubKey);
    // if(userPubKey === "020x0000000000000000000000000000000000000000000000000000000000000000") {
    return this.contract.methods.subscribe(
      serializedPubKey.pubKeyPrefix,
      serializedPubKey.pubKey
    ).encodeABI()

    // } else {
    //   this.contract.methods.subscribe().send({...this.web3.transactionOptions, value: value})
    //   .once('error', e => {
    //     reject(e);
    //   })
    //   .once('transactionHash', (hash: string) => {
    //     resolve(hash);
    //   })
    //   .once('receipt', (receipt: TransactionReceipt) => {
    //     transactionReceiptFunc(this, receipt);
    //   });
    // }
  }

  public setSubscriptionPriceAbi(priceInEth: string): string {
    const priceInWei = this.web3.client.utils.toWei(priceInEth);
    return this.contract.methods.setSubscriptionPrice(priceInWei).encodeABI()
  }

  /// Set User's comrpessed public key for subpscription content encryption.
  //TODO
  // async setUserPubKey(userPubKey: string) {
    //TODO
  // }

  withdrawBalanceAbi(): string {
    return this.contract.methods.withdrawBalance().encodeABI()
  }

  async withdrawBalanceGas(): Promise<number> {
      return this.contract.methods.withdrawBalance().estimateGas(this.web3.transactionOptions);
  }

  /**
   * Fetch ALL subscribers' data of the channel and save to the subscribers array
   **/
  async fetchSubscribersWithKeys() {
    const subscribersWithKeys = await this.contract.methods.getSubscribersWithKeys().call(this.web3.transactionOptions);
    for (let i = 0; i < subscribersWithKeys.subscribers_.length; i++ ) {
      const decompressedPubKey: string = unserializePublicKey(
        subscribersWithKeys.pubKeyPrefixes_[i],
        subscribersWithKeys.pubKeys_[i]
      );
      this.subscribers.push({
        address: subscribersWithKeys.subscribers_[i],
        decompressedPubKey
      });
    }
  }

  // private async saveUserSubscribers() {
  //   StorageService.saveUserOwnedChannel(this, this.subscribers);
  // }

  //FILEUPLOADS

  getContentLabels(): Array<string> {
    return ["All", ...this.contentLabels];
  }

  getSubscriberContents(): Array<Content> {
    return this.subscriberContents ? this.subscriberContents : [];
  }

  getActiveContentLabel(): string {
    return this.activeContentLabel;
  }

  async setActiveContentLabel(newActiveLabel: string) {
    this.activeContentLabel = newActiveLabel;
    this.subscriberContents = [];
    this.nextFetchContentsPage = 0;
    this.hasContentFetchMore = true;
    await this.fetchLabelledContentIndexes(newActiveLabel);
    console.log("activeLabel", newActiveLabel);
  }

  async fetchLabelledContentIndexes(label: string) {
    if(!this.contentLabelIndexes[label]) {
      this.contentLabelIndexes[label] = await this.contract.methods.getLabelledContentIndexes(this.web3.client.utils.fromAscii(label)).call(this.web3.transactionOptions);
    }
  }

  async getLabelledContentIndexes(label: string): Promise<Array<number>> {
    await this.fetchLabelledContentIndexes(label);
    return this.contentLabelIndexes[label]
  }

  async getContent(index: number): Promise<Content> {
    const { protocol, contentType, fileAddress, summary, uploadTime } =
      await this.contract.methods.subscriberContents(index).call(this.web3.transactionOptions)
    return {
      protocol: +protocol,
      contentType: +contentType,
      fileAddress,
      summary,
      uploadTime
    }
  }

  async subscribeForNewContentUploaded(onNewContentUploadHappened: Function) {
    console.log(`sub for NewContentUploaded event at ${this.contractAddress}`, this.channelName);
    this.activeEvents.push(this.contract.events.NewContentUploaded({
      fromBlock: this.web3.lastBlockNumber,
    }, (error: any, event: any) => {
      if (error) {
        console.log(`Error at contract event listening: ${error}`);
      }
      console.log("contentUploadEvent", event);
      onNewContentUploadHappened(this);
    }));
  }

  async unsubscribeEvents(): Promise<void> {
    for(const event of this.activeEvents) {
      event.unsubscribe();
    }
  }

  uploadSubscriberContentAbi(
    batchedLinks: string,
    protocol: FileProtocol,
    contentType: ContentType,
    contentSummary: string,
    contentLabel: string,
  ): string {
    console.log("upload subscriber content");
    const contentLabelBytes = this.web3.client.utils.fromUtf8(contentLabel);

    return this.contract.methods.uploadSubscriberContent(
      protocol,
      batchedLinks,
      contentType,
      contentSummary,
      contentLabelBytes
    ).encodeABI()
  }

  async fetchSubscriberContents(): Promise<void> {
    const page: number = this.nextFetchContentsPage;
    const items: number = this.fetchContentPageSize;
    console.log("contentPageSize", items);

    if(!this.hasContentFetchMore || this.subscriberContents.length >= (page + 1) * items) {
      return;
    }

    let contentLength = 0;
    if(this.activeContentLabel === "All") {
      contentLength = await this.contract.methods.getSubscriberContentsLength().call(this.web3.transactionOptions);
    } else {
      contentLength = this.contentLabelIndexes[this.activeContentLabel].length;
    }
    const contentFetchIndex = contentLength - (page * items) - 1;

    const contents: Array<Content> = [];

    for (let i = contentFetchIndex; i > contentFetchIndex - items && i >= 0; i--) {
      let contentIndex: number = i;
      if(this.activeContentLabel !== "All") {
        contentIndex = this.contentLabelIndexes[this.activeContentLabel][i];
      }
      const content = await this.contract.methods.subscriberContents(contentIndex).call(this.web3.transactionOptions);
      contents.push(content);
    }

    if(contentFetchIndex - items < 0) {
      this.hasContentFetchMore = false;
    }

    this.subscriberContents = this.subscriberContents.concat(contents);
  }

  needMoreContents(): void {
    this.nextFetchContentsPage++;
  }

  async fetchContentLabels(): Promise<void> {
    const contentLabels = await this.contract.methods.getContentLabels().call(this.web3.transactionOptions);
    this.contentLabels = [];
    for (const contentLabel of contentLabels) {
      this.contentLabels.push(
        this.web3.client.utils.toUtf8(contentLabel)
      );
    }
  }
}

export default ContentChannel;
