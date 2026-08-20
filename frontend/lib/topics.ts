export interface TopicCategory {
  label: string
  keywords: string[]
  questions: string[]
}

export const TOPIC_CATEGORIES: TopicCategory[] = [
  {
    label: 'Bitcoin',
    keywords: ['bitcoin', 'btc'],
    questions: [
      "What drives Bitcoin's price?",
      'How does Bitcoin mining work?',
      'Is Bitcoin good for long-term holding?',
    ],
  },
  {
    label: 'Ethereum',
    keywords: ['ethereum', 'eth', 'ether'],
    questions: [
      'How do Ethereum gas fees work?',
      'What is ETH staking and how does it earn yield?',
      'What are the top Ethereum dApps right now?',
    ],
  },
  {
    label: 'Staking',
    keywords: ['staking', 'stake', 'yield', 'validator'],
    questions: [
      'Which coins have the best staking rewards?',
      'What are the risks of staking?',
      'How do I start staking as a beginner?',
    ],
  },
  {
    label: 'DeFi',
    keywords: ['defi', 'decentralized finance', 'liquidity', 'amm', 'dex'],
    questions: [
      'What are the biggest risks in DeFi?',
      'How does yield farming work?',
      'What are the most trusted DeFi protocols?',
    ],
  },
  {
    label: 'NFTs',
    keywords: ['nft', 'non-fungible'],
    questions: [
      'How do NFTs derive their value?',
      'What are the best NFT marketplaces?',
      'Are NFTs still a good investment?',
    ],
  },
  {
    label: 'Altcoins',
    keywords: ['altcoin', 'solana', 'sol', 'bnb', 'ada', 'cardano', 'xrp'],
    questions: [
      'How do I research altcoins safely?',
      'What makes a promising altcoin?',
      'How does market cap affect altcoin risk?',
    ],
  },
  {
    label: 'Risk & Portfolio',
    keywords: ['risk', 'volatile', 'volatility', 'safe', 'invest', 'portfolio'],
    questions: [
      'How can I reduce my crypto risk exposure?',
      'What is dollar-cost averaging in crypto?',
      'What percentage of a portfolio should be in crypto?',
    ],
  },
  {
    label: 'Blockchain Tech',
    keywords: ['blockchain', 'technology', 'consensus', 'smart contract', 'layer'],
    questions: [
      'What is proof of work vs proof of stake?',
      'How does a blockchain transaction get confirmed?',
      'What is a smart contract and how does it work?',
    ],
  },
  {
    label: 'Wallets & Security',
    keywords: ['wallet', 'cold', 'hot', 'hardware', 'seed phrase', 'private key'],
    questions: [
      'What is the safest way to store crypto?',
      'What happens if I lose my seed phrase?',
      'What are the best hardware wallets?',
    ],
  },
]
