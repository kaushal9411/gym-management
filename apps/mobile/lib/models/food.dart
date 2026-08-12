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
  });

  final String id;
  final String name;
  final String? servingSize;
  final int? calories;
  final double? protein;
  final double? carbohydrates;
  final double? fat;
  final bool isActive;

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
      );
}
