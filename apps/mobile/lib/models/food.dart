/// Mirrors `FoodDto` (`GET /foods`, `/foods/:id`).
class Food {
  const Food({
    required this.id,
    required this.name,
    required this.servingSize,
    required this.calories,
    required this.protein,
    required this.carbohydrates,
    required this.fat,
    required this.isActive,
    this.category,
    this.fiber,
    this.sugar,
    this.sodium,
    this.notes,
    this.deletedAt,
  });

  final String id;
  final String name;
  final String? servingSize;
  final int? calories;
  final double? protein;
  final double? carbohydrates;
  final double? fat;
  final bool isActive;
  final String? category;
  final double? fiber;
  final double? sugar;
  final double? sodium;
  final String? notes;

  /// Non-null means soft-deleted.
  final DateTime? deletedAt;

  factory Food.fromJson(Map<String, dynamic> json) => Food(
        id: json['id'] as String,
        name: json['name'] as String,
        servingSize: json['servingSize'] as String?,
        calories: (json['calories'] as num?)?.toInt(),
        protein: _dec(json['protein']),
        carbohydrates: _dec(json['carbohydrates']),
        fat: _dec(json['fat']),
        isActive: json['isActive'] as bool? ?? true,
        category: json['category'] as String?,
        fiber: _dec(json['fiber']),
        sugar: _dec(json['sugar']),
        sodium: _dec(json['sodium']),
        notes: json['notes'] as String?,
        deletedAt: json['deletedAt'] == null
            ? null
            : DateTime.parse(json['deletedAt'] as String),
      );
}

/// Decimal columns arrive as strings (`"12.50"`); tolerate numbers too.
double? _dec(Object? v) => double.tryParse(v?.toString() ?? '');
