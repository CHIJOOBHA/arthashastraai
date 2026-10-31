/**
 * The 12 watch-desks and the 12 agents that rotate across them daily.
 * Pure data, shared by the browser (AgentRotationPanel) and the server agents.
 * Focus: how ordinary people anywhere in the world are cheated or harmed.
 */

export interface SubtopicBlock {
  blockNumber: string;
  id: string;
  name: string;
  /** What the agent searches for (used by the server). */
  focus: string;
}

export interface AgentInfo {
  agentNumber: string;
  codeName: string;
  role: string;
}

export const SUBTOPIC_BLOCKS: SubtopicBlock[] = [
  { blockNumber: "Block 01", id: "CostOfLiving", name: "Inflation, Shrinkflation & Cost of Living", focus: "price rises, shrinkflation, food and fuel costs, and gaps between official inflation figures and what households actually pay" },
  { blockNumber: "Block 02", id: "HiddenFees", name: "Hidden Fees & Bank Charges", focus: "hidden fees, junk charges, penalty fees, bank and card charges, drip pricing and subscription traps" },
  { blockNumber: "Block 03", id: "DebtTraps", name: "Predatory Lending & Debt Traps", focus: "predatory lending, payday and instant loan apps, microfinance harassment, buy-now-pay-later debt and abusive debt collection" },
  { blockNumber: "Block 04", id: "ScamsFraud", name: "Scams & Financial Fraud", focus: "Ponzi schemes, investment and crypto scams, phishing, fake job offers, impersonation and 'digital arrest' scams, and regulator warnings" },
  { blockNumber: "Block 05", id: "MisSelling", name: "Insurance & Investment Mis-selling", focus: "mis-sold insurance, rejected claims, high-commission investment products, and regulator penalties for mis-selling" },
  { blockNumber: "Block 06", id: "Cartels", name: "Monopolies, Cartels & Price Fixing", focus: "price fixing, cartels, monopoly abuse and competition-regulator fines that raised prices for consumers" },
  { blockNumber: "Block 07", id: "PublicMoney", name: "Public Money, Corruption & Cronyism", focus: "audit findings, procurement irregularities, misuse of public funds and cronyism documented by auditors, courts or investigations" },
  { blockNumber: "Block 08", id: "Taxes", name: "Taxes & Who Really Pays", focus: "tax changes, indirect taxes on essentials, tax breaks for the wealthy or corporations, and who carries the real burden" },
  { blockNumber: "Block 09", id: "Workers", name: "Wages, Jobs & Worker Rights", focus: "wage theft, unpaid wages, gig-worker exploitation, layoffs, real wage decline and unemployment data" },
  { blockNumber: "Block 10", id: "Housing", name: "Housing, Rent & Real-Estate Traps", focus: "rent increases, builder delays and fraud, housing affordability, and unfair mortgage or lease terms" },
  { blockNumber: "Block 11", id: "Healthcare", name: "Healthcare & Medicine Costs", focus: "drug price gouging, hospital overbilling, surprise medical bills, unsafe or recalled medicines and insurance denials" },
  { blockNumber: "Block 12", id: "RetailInvestors", name: "Markets & Retail Investors", focus: "losses of small investors, pump-and-dump schemes, risky derivatives sold to retail traders, IPO hype and market manipulation cases" },
];

export const AGENTS: AgentInfo[] = [
  { agentNumber: "Agent 01", codeName: "Chanakya-01", role: "Economic Warfare Specialist" },
  { agentNumber: "Agent 02", codeName: "Kautilya-02", role: "Corporate Cartel Auditor" },
  { agentNumber: "Agent 03", codeName: "Maurya-03", role: "Consumer Rights Watcher" },
  { agentNumber: "Agent 04", codeName: "Sushruta-04", role: "Health Cost & Safety Auditor" },
  { agentNumber: "Agent 05", codeName: "Gupta-05", role: "Household Money-Flow Cartographer" },
  { agentNumber: "Agent 06", codeName: "Arthavida-06", role: "Debt & Credit Guard" },
  { agentNumber: "Agent 07", codeName: "Nyaya-07", role: "Fraud & Enforcement Tracker" },
  { agentNumber: "Agent 08", codeName: "Purusha-08", role: "Investor Protection Examiner" },
  { agentNumber: "Agent 09", codeName: "Vajra-09", role: "Public Money Inspector" },
  { agentNumber: "Agent 10", codeName: "Srivatsa-10", role: "Labour & Wages Monitor" },
  { agentNumber: "Agent 11", codeName: "Dharma-11", role: "Tax Fairness Auditor" },
  { agentNumber: "Agent 12", codeName: "Akasha-12", role: "Scam Signal Sentinel" },
];

/** Agents rotate across blocks once per UTC day. */
export function getAgentRotation(timeMs: number = Date.now()) {
  const n = SUBTOPIC_BLOCKS.length;
  const dayOffset = Math.floor(timeMs / (24 * 60 * 60 * 1000));
  const agentToBlock = AGENTS.map((agent, index) => {
    const blockIndex = (index + dayOffset) % n;
    return { agent, block: SUBTOPIC_BLOCKS[blockIndex], blockIndex };
  });
  const blockToAgent = SUBTOPIC_BLOCKS.map((block, bIndex) => {
    const agentIndex = (((bIndex - dayOffset) % n) + n) % n;
    return { block, agent: AGENTS[agentIndex], agentIndex };
  });
  return { dayOffset, agentToBlock, blockToAgent };
}

export function agentForBlock(blockId: string, timeMs: number = Date.now()): AgentInfo {
  const hit = getAgentRotation(timeMs).blockToAgent.find((x) => x.block.id === blockId);
  return hit ? hit.agent : AGENTS[0];
}
