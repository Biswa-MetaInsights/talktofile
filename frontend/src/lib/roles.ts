import {
  LineChart, Scale, Building2, Stethoscope, GraduationCap, Briefcase,
  BarChart3, Megaphone, Users, School, Rocket, Handshake, Sparkles, type LucideIcon,
} from 'lucide-react'

// The professional roles offered at signup and in Personalise. `key` MUST match the
// backend ROLE_PRESETS keys (agents/persona_agent.py) — that's the source of truth for
// the persona each one generates. Labels/icons/descriptions are display-only.
export interface Role { key: string; label: string; desc: string; Icon: LucideIcon }

export const ROLES: Role[] = [
  { key: 'financial', label: 'Financial Analyst', desc: 'Statements, valuation, markets', Icon: LineChart },
  { key: 'legal', label: 'Legal Analyst', desc: 'Contracts, compliance, risk', Icon: Scale },
  { key: 'real_estate', label: 'Real Estate Analyst', desc: 'Valuation, yields, leases', Icon: Building2 },
  { key: 'medical', label: 'Medical / Clinical', desc: 'Clinical docs, terminology', Icon: Stethoscope },
  { key: 'academic', label: 'Academic Researcher', desc: 'Literature, methodology', Icon: GraduationCap },
  { key: 'consulting', label: 'Management Consultant', desc: 'Strategy, operations', Icon: Briefcase },
  { key: 'data', label: 'Data / Technical Analyst', desc: 'Metrics, statistics, specs', Icon: BarChart3 },
  { key: 'marketing', label: 'Marketing Analyst', desc: 'Campaigns, funnel, insight', Icon: Megaphone },
  { key: 'hr', label: 'HR / Talent Analyst', desc: 'Policy, talent, org', Icon: Users },
  { key: 'education', label: 'Educator / Teaching', desc: 'Curriculum, pedagogy', Icon: School },
  { key: 'product', label: 'Product Manager', desc: 'Specs, roadmaps, metrics', Icon: Rocket },
  { key: 'sales', label: 'Sales Analyst', desc: 'Pipeline, forecasting, quota', Icon: Handshake },
]

export const GENERAL: Role = { key: 'general', label: 'General', desc: 'A strong all-round analyst', Icon: Sparkles }

// All roles including General, for pickers that show them together.
export const ALL_ROLES: Role[] = [...ROLES, GENERAL]
