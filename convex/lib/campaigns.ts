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
    slug: "consultation",
    name: "Free in-home consultation",
    isDefault: true,
    touch1Subject: "Free {{vertical}} check for {{address}}",
    touch1Body: `Hi {{owner_first_name}},

I'm {{contractor_name}} — we help SF homeowners with {{vertical}} work.

Based on your property's permit history, a quick inspection could catch issues before they become expensive. I'd love to offer a free, no-pressure consultation at {{address}}.

Would {{meeting_window}} work for a 20-minute visit?

Best,
{{contractor_name}}
{{contractor_business}}`,
    touch2Subject: "Re: free consultation at {{address}}",
    touch2Body: `Hi {{owner_first_name}},

Following up on my note about a free {{vertical}} assessment at {{address}}.

{{vertical_hook}}

Happy to answer questions by reply, phone, or a quick visit.

{{contractor_name}}`,
  },
  {
    slug: "quote",
    name: "Free quote offer",
    touch1Subject: "Quick quote for {{address}}",
    touch1Body: `Hi {{owner_first_name}},

This is {{contractor_name}} with {{contractor_business}}. We specialize in {{vertical}} for SF homes like yours.

I can put together a free quote after a brief walkthrough at {{address}}. No obligation.

Are you free {{meeting_window}}?

Thanks,
{{contractor_name}}`,
    touch2Subject: "Still happy to quote {{address}}",
    touch2Body: `Hi {{owner_first_name}},

Wanted to bump this — still available for a free {{vertical}} quote at {{address}}.

{{vertical_hook}}

{{contractor_name}}`,
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
