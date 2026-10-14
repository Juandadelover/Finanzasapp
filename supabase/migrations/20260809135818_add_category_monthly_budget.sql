alter table public.categories
  add column monthly_budget numeric(14,2),
  add constraint categories_budget_expense_only
    check (monthly_budget is null or type = 'expense');
