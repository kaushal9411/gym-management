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

  /// The labels web's `EXPENSE_CATEGORY_META` / category select use.
  String get label => switch (this) {
        ExpenseCategory.rent => 'Rent',
        ExpenseCategory.salary => 'Salary',
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

/// Mirrors `ExpenseDto` (web's `Expense`).
class ExpenseEntry {
  const ExpenseEntry({
    required this.id,
    required this.category,
    required this.amount,
    required this.expenseDate,
    required this.description,
    this.branchName,
    this.recordedByName,
    this.receiptFileName,
    this.receiptUrl,
  });

  final String id;
  final ExpenseCategory category;
  final double amount;

  /// `@db.Date` column — the API sends a plain `YYYY-MM-DD`; show its calendar
  /// day without any timezone conversion.
  final DateTime expenseDate;
  final String? description;
  final String? branchName;
  final String? recordedByName;
  final String? receiptFileName;

  /// The API's `receiptDataUrl`: a freshly presigned download URL (receipts
  /// are stored privately), or null when no receipt is attached.
  final String? receiptUrl;

  bool get hasReceipt => receiptUrl != null && receiptUrl!.isNotEmpty;

  factory ExpenseEntry.fromJson(Map<String, dynamic> json) {
    final branch = json['branch'];
    final recordedBy = json['recordedBy'];
    return ExpenseEntry(
      id: json['id'] as String,
      category: ExpenseCategoryX.fromApi(json['category'] as String),
      amount: double.tryParse(json['amount']?.toString() ?? '') ?? 0,
      expenseDate: DateTime.parse(json['expenseDate'] as String),
      description: json['description'] as String?,
      branchName: branch is Map ? branch['name'] as String? : null,
      recordedByName: recordedBy is Map ? recordedBy['name'] as String? : null,
      receiptFileName: json['receiptFileName'] as String?,
      receiptUrl: json['receiptDataUrl'] as String?,
    );
  }
}
