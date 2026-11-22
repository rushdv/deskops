import { TicketPriority } from '@prisma/client';

export interface TicketRuleInput {
  title: string;
  description: string;
  category: string;
  priority?: TicketPriority;
}

export interface RuleExecutionResult {
  modifiedPriority: TicketPriority;
  appliedRules: string[];
  isEscalated: boolean;
}

export class RuleInterceptor {
  private static CRITICAL_KEYWORDS = [
    'gas leak',
    'gas smell',
    'sparking',
    'electrical fire',
    'flooding',
    'burst pipe',
    'sewage overflow',
    'exposed wire',
  ];

  /**
   * Evaluates inbound ticket against Team 6 client-specific business rules (FR-1.08, AC-1.5)
   * Automatically elevates priority to URGENT if critical safety hazard or flood keywords are detected.
   */
  static applyCreationRules(input: TicketRuleInput): RuleExecutionResult {
    const combinedText = `${input.title} ${input.description}`.toLowerCase();
    const appliedRules: string[] = [];
    let priority: TicketPriority = input.priority || TicketPriority.MEDIUM;
    let isEscalated = false;

    // Rule 1: Emergency & Safety Hazard Auto-Escalation
    const matchedKeyword = this.CRITICAL_KEYWORDS.find((keyword) => combinedText.includes(keyword));

    if (matchedKeyword) {
      priority = TicketPriority.URGENT;
      isEscalated = true;
      appliedRules.push(`RULE_SAFETY_HAZARD_ELEVATION: Elevated to URGENT due to detected keyword '${matchedKeyword}'`);
    }

    // Rule 2: Water damage priority floor (Plumbing category with flooding)
    if (input.category.toLowerCase() === 'plumbing' && combinedText.includes('water leak')) {
      if (priority === TicketPriority.LOW) {
        priority = TicketPriority.HIGH;
        appliedRules.push('RULE_WATER_DAMAGE_FLOOR: Minimum priority elevated to HIGH');
      }
    }

    return {
      modifiedPriority: priority,
      appliedRules,
      isEscalated,
    };
  }
}
