import 'package:flutter/material.dart';

void main() {
  runApp(const FitCloudApp());
}

class FitCloudApp extends StatelessWidget {
  const FitCloudApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'FitCloud',
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        body: Center(child: Text('FitCloud')),
      ),
    );
  }
}
