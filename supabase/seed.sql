-- Seed Default Demo Thesis
INSERT INTO acquisition_theses (
    id, name, industry, geography, min_revenue, max_revenue, min_employees, max_employees, min_business_age, prefer_founder_led, prefer_independent, exclusion_keywords, notes
) VALUES (
    'thesis-it-services-us',
    'B2B IT & Managed Services (US Lower-Middle Market)',
    'IT Services',
    'United States',
    2000000,
    15000000,
    10,
    75,
    10,
    TRUE,
    TRUE,
    '["venture capital", "franchise", "crypto", "cannabis"]'::jsonb,
    'Targeting established, cash-flowing IT Managed Service Providers and specialized B2B software/IT integration firms with founder-operators approaching transition.'
) ON CONFLICT (id) DO NOTHING;

-- Seed Key Targets
INSERT INTO companies (
    id, name, domain, website, normalized_domain, industry, location, revenue, employees, founded_year, linkedin_url, contact_name, contact_title, contact_email, description, crawl_status, crawled_pages_count
) VALUES (
    'comp-101',
    'Apex Managed Solutions',
    'apexmanaged.com',
    'https://apexmanaged.com',
    'apexmanaged.com',
    'IT Services',
    'Denver, CO, United States',
    6500000,
    34,
    2008,
    'https://linkedin.com/company/apex-managed-solutions',
    'David Sterling',
    'Founder & CEO',
    'dsterling@apexmanaged.com',
    'Regional IT Managed Service Provider delivering outsourced cloud infrastructure, cybersecurity monitoring, and helpdesk support for mid-market healthcare and financial firms.',
    'SUCCESS',
    4
), (
    'comp-102',
    'Miller & Sons Technology Group',
    'millertechgroup.com',
    'https://millertechgroup.com',
    'millertechgroup.com',
    'IT Services',
    'Columbus, OH, United States',
    8200000,
    48,
    1996,
    'https://linkedin.com/company/miller-tech-group',
    'Robert Miller Jr.',
    'Managing Partner',
    'rmiller@millertechgroup.com',
    'Second-generation enterprise network design and managed IT operations specialist serving industrial manufacturers and legal firms across the Midwest.',
    'SUCCESS',
    4
) ON CONFLICT (id) DO NOTHING;
