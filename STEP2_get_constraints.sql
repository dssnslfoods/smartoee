column_name;constraint_name;constraint_type;delete_rule;foreign_column;foreign_table;table_name;update_rule
id;audit_logs_pkey;PRIMARY KEY;;;;audit_logs;
id;companies_pkey;PRIMARY KEY;;;;companies;
code;companies_code_unique;UNIQUE;;;;companies;
company_id;defect_reasons_company_id_fkey;FOREIGN KEY;NO ACTION;id;companies;defect_reasons;NO ACTION
id;defect_reasons_pkey;PRIMARY KEY;;;;defect_reasons;
code;defect_reasons_code_key;UNIQUE;;;;defect_reasons;
company_id;downtime_reasons_company_id_fkey;FOREIGN KEY;NO ACTION;id;companies;downtime_reasons;NO ACTION
id;downtime_reasons_pkey;PRIMARY KEY;;;;downtime_reasons;
code;downtime_reasons_code_key;UNIQUE;;;;downtime_reasons;
company_id;holidays_company_id_fkey;FOREIGN KEY;NO ACTION;id;companies;holidays;NO ACTION
plant_id;holidays_plant_id_fkey;FOREIGN KEY;NO ACTION;id;plants;holidays;NO ACTION
id;holidays_pkey;PRIMARY KEY;;;;holidays;
company_id;holidays_company_id_plant_id_holiday_date_key;UNIQUE;;;;holidays;
holiday_date;holidays_company_id_plant_id_holiday_date_key;UNIQUE;;;;holidays;
plant_id;holidays_company_id_plant_id_holiday_date_key;UNIQUE;;;;holidays;
company_id;lines_company_id_fkey;FOREIGN KEY;NO ACTION;id;companies;lines;NO ACTION
plant_id;lines_plant_id_fkey;FOREIGN KEY;CASCADE;id;plants;lines;NO ACTION
id;lines_pkey;PRIMARY KEY;;;;lines;
code;lines_code_key;UNIQUE;;;;lines;
group_id;machine_permission_group_machines_group_id_fkey;FOREIGN KEY;CASCADE;id;machine_permission_groups;machine_permission_group_machines;NO ACTION
machine_id;machine_permission_group_machines_machine_id_fkey;FOREIGN KEY;CASCADE;id;machines;machine_permission_group_machines;NO ACTION
id;machine_permission_group_machines_pkey;PRIMARY KEY;;;;machine_permission_group_machines;
machine_id;machine_permission_group_machines_group_id_machine_id_key;UNIQUE;;;;machine_permission_group_machines;
group_id;machine_permission_group_machines_group_id_machine_id_key;UNIQUE;;;;machine_permission_group_machines;
company_id;machine_permission_groups_company_id_fkey;FOREIGN KEY;CASCADE;id;companies;machine_permission_groups;NO ACTION
id;machine_permission_groups_pkey;PRIMARY KEY;;;;machine_permission_groups;
company_id;machines_company_id_fkey;FOREIGN KEY;NO ACTION;id;companies;machines;NO ACTION
line_id;machines_line_id_fkey;FOREIGN KEY;CASCADE;id;lines;machines;NO ACTION
id;machines_pkey;PRIMARY KEY;;;;machines;
code;machines_code_key;UNIQUE;;;;machines;
shift_calendar_id;oee_snapshots_shift_calendar_id_fkey;FOREIGN KEY;SET NULL;id;shift_calendar;oee_snapshots;NO ACTION
id;oee_snapshots_pkey;PRIMARY KEY;;;;oee_snapshots;
company_id;planned_time_templates_company_id_fkey;FOREIGN KEY;NO ACTION;id;companies;planned_time_templates;NO ACTION
plant_id;planned_time_templates_plant_id_fkey;FOREIGN KEY;NO ACTION;id;plants;planned_time_templates;NO ACTION
shift_id;planned_time_templates_shift_id_fkey;FOREIGN KEY;CASCADE;id;shifts;planned_time_templates;NO ACTION
id;planned_time_templates_pkey;PRIMARY KEY;;;;planned_time_templates;
shift_id;planned_time_templates_plant_id_shift_id_key;UNIQUE;;;;planned_time_templates;
plant_id;planned_time_templates_plant_id_shift_id_key;UNIQUE;;;;planned_time_templates;
company_id;plants_company_id_fkey;FOREIGN KEY;NO ACTION;id;companies;plants;NO ACTION
id;plants_pkey;PRIMARY KEY;;;;plants;
code;plants_code_key;UNIQUE;;;;plants;
created_by;production_counts_created_by_fkey;FOREIGN KEY;NO ACTION;;;production_counts;NO ACTION
defect_reason_id;production_counts_defect_reason_id_fkey;FOREIGN KEY;NO ACTION;id;defect_reasons;production_counts;NO ACTION
machine_id;production_counts_machine_id_fkey;FOREIGN KEY;CASCADE;id;machines;production_counts;NO ACTION
production_event_id;production_counts_production_event_id_fkey;FOREIGN KEY;NO ACTION;id;production_events;production_counts;NO ACTION
shift_calendar_id;production_counts_shift_calendar_id_fkey;FOREIGN KEY;SET NULL;id;shift_calendar;production_counts;NO ACTION
id;production_counts_pkey;PRIMARY KEY;;;;production_counts;
created_by;production_events_created_by_fkey;FOREIGN KEY;NO ACTION;;;production_events;NO ACTION
line_id;production_events_line_id_fkey;FOREIGN KEY;CASCADE;id;lines;production_events;NO ACTION
machine_id;production_events_machine_id_fkey;FOREIGN KEY;CASCADE;id;machines;production_events;NO ACTION
plant_id;production_events_plant_id_fkey;FOREIGN KEY;CASCADE;id;plants;production_events;NO ACTION
product_id;production_events_product_id_fkey;FOREIGN KEY;NO ACTION;id;products;production_events;NO ACTION
shift_calendar_id;production_events_shift_calendar_id_fkey;FOREIGN KEY;SET NULL;id;shift_calendar;production_events;NO ACTION
id;production_events_pkey;PRIMARY KEY;;;;production_events;
id;production_standards_pkey;PRIMARY KEY;;;;production_standards;
machine_id;production_standards_machine_id_product_id_key;UNIQUE;;;;production_standards;
product_id;production_standards_machine_id_product_id_key;UNIQUE;;;;production_standards;
line_id;products_line_id_fkey;FOREIGN KEY;NO ACTION;id;lines;products;NO ACTION
id;products_pkey;PRIMARY KEY;;;;products;
company_id;products_company_code_unique;UNIQUE;;;;products;
code;products_company_code_unique;UNIQUE;;;;products;
company_id;setup_reasons_company_id_fkey;FOREIGN KEY;NO ACTION;id;companies;setup_reasons;NO ACTION
id;setup_reasons_pkey;PRIMARY KEY;;;;setup_reasons;
approved_by;shift_approvals_approved_by_fkey;FOREIGN KEY;NO ACTION;;;shift_approvals;NO ACTION
locked_by;shift_approvals_locked_by_fkey;FOREIGN KEY;NO ACTION;;;shift_approvals;NO ACTION
shift_calendar_id;shift_approvals_shift_calendar_id_fkey;FOREIGN KEY;CASCADE;id;shift_calendar;shift_approvals;NO ACTION
id;shift_approvals_pkey;PRIMARY KEY;;;;shift_approvals;
shift_calendar_id;shift_approvals_shift_calendar_id_key;UNIQUE;;;;shift_approvals;
plant_id;shift_calendar_plant_id_fkey;FOREIGN KEY;CASCADE;id;plants;shift_calendar;NO ACTION
shift_id;shift_calendar_shift_id_fkey;FOREIGN KEY;CASCADE;id;shifts;shift_calendar;NO ACTION
id;shift_calendar_pkey;PRIMARY KEY;;;;shift_calendar;
shift_id;shift_calendar_shift_id_shift_date_plant_id_key;UNIQUE;;;;shift_calendar;
shift_date;shift_calendar_shift_id_shift_date_plant_id_key;UNIQUE;;;;shift_calendar;
plant_id;shift_calendar_shift_id_shift_date_plant_id_key;UNIQUE;;;;shift_calendar;
company_id;shifts_company_id_fkey;FOREIGN KEY;NO ACTION;id;companies;shifts;NO ACTION
plant_id;shifts_plant_id_fkey;FOREIGN KEY;NO ACTION;id;plants;shifts;NO ACTION
id;shifts_pkey;PRIMARY KEY;;;;shifts;
line_id;user_line_permissions_line_id_fkey;FOREIGN KEY;CASCADE;id;lines;user_line_permissions;NO ACTION
user_id;user_line_permissions_user_id_fkey;FOREIGN KEY;CASCADE;;;user_line_permissions;NO ACTION
id;user_line_permissions_pkey;PRIMARY KEY;;;;user_line_permissions;
user_id;user_line_permissions_user_id_line_id_key;UNIQUE;;;;user_line_permissions;
line_id;user_line_permissions_user_id_line_id_key;UNIQUE;;;;user_line_permissions;
machine_id;user_machine_permissions_machine_id_fkey;FOREIGN KEY;CASCADE;id;machines;user_machine_permissions;NO ACTION
user_id;user_machine_permissions_user_id_fkey;FOREIGN KEY;CASCADE;;;user_machine_permissions;NO ACTION
id;user_machine_permissions_pkey;PRIMARY KEY;;;;user_machine_permissions;
machine_id;user_machine_permissions_user_id_machine_id_key;UNIQUE;;;;user_machine_permissions;
user_id;user_machine_permissions_user_id_machine_id_key;UNIQUE;;;;user_machine_permissions;
group_id;user_permission_groups_group_id_fkey;FOREIGN KEY;CASCADE;id;machine_permission_groups;user_permission_groups;NO ACTION
id;user_permission_groups_pkey;PRIMARY KEY;;;;user_permission_groups;
user_id;user_permission_groups_user_id_group_id_key;UNIQUE;;;;user_permission_groups;
group_id;user_permission_groups_user_id_group_id_key;UNIQUE;;;;user_permission_groups;
plant_id;user_plant_permissions_plant_id_fkey;FOREIGN KEY;CASCADE;id;plants;user_plant_permissions;NO ACTION
user_id;user_plant_permissions_user_id_fkey;FOREIGN KEY;CASCADE;;;user_plant_permissions;NO ACTION
id;user_plant_permissions_pkey;PRIMARY KEY;;;;user_plant_permissions;
plant_id;user_plant_permissions_user_id_plant_id_key;UNIQUE;;;;user_plant_permissions;
user_id;user_plant_permissions_user_id_plant_id_key;UNIQUE;;;;user_plant_permissions;
company_id;user_profiles_company_id_fkey;FOREIGN KEY;NO ACTION;id;companies;user_profiles;NO ACTION
user_id;user_profiles_user_id_fkey;FOREIGN KEY;CASCADE;;;user_profiles;NO ACTION
id;user_profiles_pkey;PRIMARY KEY;;;;user_profiles;
user_id;user_profiles_user_id_key;UNIQUE;;;;user_profiles;