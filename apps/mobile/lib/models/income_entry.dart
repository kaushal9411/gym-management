enum IncomeCategory { membershipFee, personalTraining, productSales, other }

extension IncomeCategoryX on IncomeCategory {
  String get apiValue => switch (this) {
        IncomeCategory.membershipFee => 'MEMBERSHIP_FEE',
        IncomeCategory.personalTraining => 'PERSONAL_TRAINING',
        IncomeCategory.productSales => 'PRODUCT_SALES',
        IncomeCategory.other => 'OTHER',
      };

  /// Short labels from the original mobile design (still used by the
  /// dashboard sheet and the shared ledger header).
  String get label => switch (this) {
        IncomeCategory.membershipFee => 'Membership',
        IncomeCategory.personalTraining => 'PT add-on',
        IncomeCategory.productSales => 'Merchandise',
        IncomeCategory.other => 'Other',
      };

  /// The labels web's `INCOME_CATEGORY_META` uses — what the Income screens
  /// show.
  String get webLabel => switch (this) {
        IncomeCategory.membershipFee => 'Membership Fee',
        IncomeCategory.personalTraining => 'Personal Training',
        IncomeCategory.productSales => 'Product Sales',
        IncomeCategory.other => 'Other',
      };

  static IncomeCategory fromApi(String value) => switch (value) {
        'MEMBERSHIP_FEE' => IncomeCategory.membershipFee,
        'PERSONAL_TRAINING' => IncomeCategory.personalTraining,
        'PRODUCT_SALES' => IncomeCategory.productSales,
        _ => IncomeCategory.other,
      };
}

/// Mirrors `IncomeDto`.
class IncomeEntry {
  const IncomeEntry({
    required this.id,
    required this.category,
    required this.amount,
    required this.incomeDate,
    required this.description,
    this.branchName,
    this.recordedByName,
    this.sourcePaymentId,
  });

  final String id;
  final IncomeCategory category;
  final double amount;

  /// `@db.Date` column — arrives as UTC midnight; show its calendar day
  /// without converting to local time.
  final DateTime incomeDate;
  final String? description;
  final String? branchName;
  final String? recordedByName;

  /// Set on entries the system created from a payment — those can't be deleted
  /// by hand (the API refuses) and web shows "Auto (payment)" for them.
  final String? sourcePaymentId;

  bool get isAuto => sourcePaymentId != null;

  factory IncomeEntry.fromJson(Map<String, dynamic> json) {
    final branch = json['branch'];
    final recordedBy = json['recordedBy'];
    return IncomeEntry(
      id: json['id'] as String,
      category: IncomeCategoryX.fromApi(json['category'] as String),
      amount: double.tryParse(json['amount']?.toString() ?? '') ?? 0,
      incomeDate: DateTime.parse(json['incomeDate'] as String),
      description: json['description'] as String?,
      branchName: branch is Map ? branch['name'] as String? : null,
      recordedByName: recordedBy is Map ? recordedBy['name'] as String? : null,
      sourcePaymentId: json['sourcePaymentId'] as String?,
    );
  }
}
