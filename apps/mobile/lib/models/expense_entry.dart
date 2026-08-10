enum ExpenseCategory {
  rent,
  salary,
  utilities,
  equipment,
  maintenance,
  marketing,
  officeSupplies,
  other
}

extension ExpenseCategoryX on ExpenseCategory {
  String get apiValue => switch (this) {
        ExpenseCategory.rent => 'RENT',
        ExpenseCategory.salary => 'SALARY',
        ExpenseCategory.utilities => 'UTILITIES',
        ExpenseCategory.equipment => 'EQUIPMENT',
        ExpenseCategory.maintenance => 'MAINTENANCE',
        ExpenseCategory.marketing => 'MARKETING',
        ExpenseCategory.officeSupplies => 'OFFICE_SUPPLIES',
        ExpenseCategory.other => 'OTHER',
      };

  String get label => switch (this) {
        ExpenseCategory.rent => 'Rent',
        ExpenseCategory.salary => 'Salaries',
        ExpenseCategory.utilities => 'Utilities',
        ExpenseCategory.equipment => 'Equipment',
        ExpenseCategory.maintenance => 'Maintenance',
        ExpenseCategory.marketing => 'Marketing',
        ExpenseCategory.officeSupplies => 'Office Supplies',
        ExpenseCategory.other => 'Other',
      };

  static ExpenseCategory fromApi(String value) => switch (value) {
        'RENT' => ExpenseCategory.rent,
        'SALARY' => ExpenseCategory.salary,
        'UTILITIES' => ExpenseCategory.utilities,
        'EQUIPMENT' => ExpenseCategory.equipment,
        'MAINTENANCE' => ExpenseCategory.maintenance,
        'MARKETING' => ExpenseCategory.marketing,
        'OFFICE_SUPPLIES' => ExpenseCategory.officeSupplies,
        _ => ExpenseCategory.other,
      };
}

/// Mirrors `ExpenseDto` (receipt fields omitted — not surfaced in this pass).
class ExpenseEntry {
  const ExpenseEntry({
    required this.id,
    required this.category,
    required this.amount,
    required this.expenseDate,
    required this.description,
  });

  final String id;
  final ExpenseCategory category;
  final double amount;
  final DateTime expenseDate;
  final String? description;

  factory ExpenseEntry.fromJson(Map<String, dynamic> json) => ExpenseEntry(
        id: json['id'] as String,
        category: ExpenseCategoryX.fromApi(json['category'] as String),
        amount: double.parse(json['amount'] as String),
        expenseDate: DateTime.parse(json['expenseDate'] as String),
        description: json['description'] as String?,
      );
}
