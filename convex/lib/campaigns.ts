export type CampaignTemplate = {
  slug: string;
  name: string;
  touch1Subject: string;
  touch1Body: string;
  touch2Subject: string;
  touch2Body: string;
  isDefault?: boolean;
};

export const DEFAULT_CAMPAIGNS: CampaignTemplate[] = [
  {
    slug: "coverage_review",
    name: "Coverage review offer",
    isDefault: true,
    touch1Subject: "Quick coverage check for {{address}}",
    touch1Body: `Hi {{owner_first_name}},

I'm {{agent_name}} with {{agency_name}}. We help SF homeowners make sure Coverage A keeps up with today's rebuild costs.

{{coverage_hook}}

I'd be glad to offer a complimentary, no-pressure coverage review for your home at {{address}}. Would {{meeting_window}} work for a brief call or visit?

Best,
{{agent_name}}
{{agency_name}}`,
    touch2Subject: "Following up — coverage at {{address}}",
    touch2Body: `Hi {{owner_first_name}},

Quick follow-up on my note about a complimentary coverage review at {{address}}.

{{coverage_hook}}

Happy to answer questions by reply or phone.

{{agent_name}}
{{agency_name}}`,
  },
  {
    slug: "renewal_window",
    name: "Renewal timing outreach",
    touch1Subject: "Before your renewal — {{address}}",
    touch1Body: `Hi {{owner_first_name}},

This is {{agent_name}} from {{agency_name}}. Many SF homeowners review their home policy before renewal — especially when rebuild costs have moved faster than Coverage A.

{{coverage_hook}}

If you'd like a second look before your next renewal, I can walk through options for {{address}}. Are you free {{meeting_window}}?

Thanks,
{{agent_name}}
{{agency_name}}`,
    touch2Subject: "Re: renewal timing at {{address}}",
    touch2Body: `Hi {{owner_first_name}},

Wanted to bump this — still happy to do a quick coverage review for {{address}} before renewal season.

{{coverage_hook}}

{{agent_name}}`,
  },
];

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export function pickCampaign(
  campaigns: CampaignTemplate[],
  slug?: string,
): CampaignTemplate {
  return (
    (slug ? campaigns.find((c) => c.slug === slug) : undefined) ??
    campaigns.find((c) => c.isDefault) ??
    campaigns[0]
  );
}
