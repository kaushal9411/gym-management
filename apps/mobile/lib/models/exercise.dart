enum ExerciseDifficulty { beginner, intermediate, advanced }

extension ExerciseDifficultyX on ExerciseDifficulty {
  String get apiValue => switch (this) {
        ExerciseDifficulty.beginner => 'BEGINNER',
        ExerciseDifficulty.intermediate => 'INTERMEDIATE',
        ExerciseDifficulty.advanced => 'ADVANCED',
      };

  String get label => switch (this) {
        ExerciseDifficulty.beginner => 'Beginner',
        ExerciseDifficulty.intermediate => 'Intermediate',
        ExerciseDifficulty.advanced => 'Advanced',
      };

  static ExerciseDifficulty fromApi(String v) => switch (v) {
        'ADVANCED' => ExerciseDifficulty.advanced,
        'INTERMEDIATE' => ExerciseDifficulty.intermediate,
        _ => ExerciseDifficulty.beginner,
      };
}

/// Mirrors `ExerciseDto` (`GET /exercises`, `/exercises/:id`).
class Exercise {
  const Exercise({
    required this.id,
    required this.name,
    required this.category,
    required this.muscleGroup,
    required this.equipment,
    required this.difficultyLevel,
    required this.instructions,
    required this.defaultSets,
    required this.defaultReps,
    required this.isActive,
    this.imageUrl,
    this.videoUrl,
    this.durationSeconds,
    this.restSeconds,
    this.caloriesBurnEstimate,
    this.deletedAt,
  });

  final String id;
  final String name;
  final String? category;
  final String? muscleGroup;
  final String? equipment;
  final ExerciseDifficulty difficultyLevel;
  final String? instructions;
  final int? defaultSets;
  final int? defaultReps;
  final bool isActive;
  final String? imageUrl;
  final String? videoUrl;
  final int? durationSeconds;
  final int? restSeconds;
  final int? caloriesBurnEstimate;

  /// Non-null means soft-deleted — same convention as `GymMember`/`StaffMember`.
  final DateTime? deletedAt;

  factory Exercise.fromJson(Map<String, dynamic> json) => Exercise(
        id: json['id'] as String,
        name: json['name'] as String,
        category: json['category'] as String?,
        muscleGroup: json['muscleGroup'] as String?,
        equipment: json['equipment'] as String?,
        difficultyLevel:
            ExerciseDifficultyX.fromApi(json['difficultyLevel'] as String),
        instructions: json['instructions'] as String?,
        defaultSets: json['defaultSets'] as int?,
        defaultReps: json['defaultReps'] as int?,
        isActive: json['isActive'] as bool? ?? true,
        imageUrl: json['imageUrl'] as String?,
        videoUrl: json['videoUrl'] as String?,
        durationSeconds: json['durationSeconds'] as int?,
        restSeconds: json['restSeconds'] as int?,
        caloriesBurnEstimate: json['caloriesBurnEstimate'] as int?,
        deletedAt: json['deletedAt'] == null
            ? null
            : DateTime.parse(json['deletedAt'] as String),
      );
}
