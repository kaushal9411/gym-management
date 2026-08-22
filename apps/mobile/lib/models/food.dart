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
        calories: json['calories'] as int?,
        protein: json['protein'] == null
            ? null
            : double.parse(json['protein'] as String),
        carbohydrates: json['carbohydrates'] == null
            ? null
            : double.parse(json['carbohydrates'] as String),
        fat: json['fat'] == null ? null : double.parse(json['fat'] as String),
        isActive: json['isActive'] as bool? ?? true,
        category: json['category'] as String?,
        fiber: json['fiber'] == null
            ? null
            : double.parse(json['fiber'] as String),
        sugar: json['sugar'] == null
            ? null
            : double.parse(json['sugar'] as String),
        sodium: json['sodium'] == null
            ? null
            : double.parse(json['sodium'] as String),
        notes: json['notes'] as String?,
        deletedAt: json['deletedAt'] == null
            ? null
            : DateTime.parse(json['deletedAt'] as String),
      );
}
