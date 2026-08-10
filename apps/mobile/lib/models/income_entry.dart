enum IncomeCategory { membershipFee, personalTraining, productSales, other }

extension IncomeCategoryX on IncomeCategory {
  String get apiValue => switch (this) {
        IncomeCategory.membershipFee => 'MEMBERSHIP_FEE',
        IncomeCategory.personalTraining => 'PERSONAL_TRAINING',
        IncomeCategory.productSales => 'PRODUCT_SALES',
        IncomeCategory.other => 'OTHER',
      };

  String get label => switch (this) {
        IncomeCategory.membershipFee => 'Membership',
        IncomeCategory.personalTraining => 'PT add-on',
        IncomeCategory.productSales => 'Merchandise',
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
  });

  final String id;
  final IncomeCategory category;
  final double amount;
  final DateTime incomeDate;
  final String? description;

  factory IncomeEntry.fromJson(Map<String, dynamic> json) => IncomeEntry(
        id: json['id'] as String,
        category: IncomeCategoryX.fromApi(json['category'] as String),
        amount: double.parse(json['amount'] as String),
        incomeDate: DateTime.parse(json['incomeDate'] as String),
        description: json['description'] as String?,
      );
}
