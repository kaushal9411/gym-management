import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/expenses/presentation/expense_ui.dart';
import 'package:gym_saas_mobile/models/expense_entry.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';

UserProfile _user(List<String> permissions) => UserProfile(
      id: 'u',
      tenantId: 't',
      name: 'U',
      email: 'u@x.test',
      phone: null,
      status: 'ACTIVE',
      roles: const ['MANAGER'],
      permissions: permissions,
    );

void main() {
  group('ExpenseEntry.fromJson', () {
    test('parses the full DTO (amount arrives as a decimal string)', () {
      final e = ExpenseEntry.fromJson({
        'id': 'e1',
        'category': 'OFFICE_SUPPLIES',
        'amount': '1250.50',
        'expenseDate': '2026-10-17',
        'branch': {'id': 'b1', 'name': 'Bandra'},
        'description': 'Printer paper',
        'receiptFileName': 'bill.jpg',
        'receiptDataUrl': 'https://files.test/bill.jpg?sig=1',
        'recordedBy': {'id': 'u', 'name': 'Asha'},
        'createdAt': '2026-10-17T10:00:00.000Z',
        'updatedAt': '2026-10-17T10:00:00.000Z',
        'deletedAt': null,
      });
      expect(e.category, ExpenseCategory.officeSupplies);
      expect(e.amount, 1250.5);
      expect(e.expenseDate, DateTime(2026, 10, 17));
      expect(e.branchName, 'Bandra');
      expect(e.recordedByName, 'Asha');
      expect(e.receiptFileName, 'bill.jpg');
      expect(e.hasReceipt, isTrue);
    });

    test('degrades on the minimal shape (no branch / receipt / author)', () {
      final e = ExpenseEntry.fromJson({
        'id': 'e2',
        'category': 'SOMETHING_NEW',
        'amount': 'oops',
        'expenseDate': '2026-10-17T00:00:00.000Z',
        'description': null,
        'branch': null,
        'recordedBy': null,
        'receiptFileName': null,
        'receiptDataUrl': null,
      });
      expect(e.category, ExpenseCategory.other);
      expect(e.amount, 0);
      expect(e.branchName, isNull);
      expect(e.recordedByName, isNull);
      expect(e.hasReceipt, isFalse);
    });
  });

  group('categories', () {
    test('api values and web labels round-trip for every category', () {
      const labels = {
        'RENT': 'Rent',
        'SALARY': 'Salary',
        'UTILITIES': 'Utilities',
        'EQUIPMENT': 'Equipment',
        'MAINTENANCE': 'Maintenance',
        'MARKETING': 'Marketing',
        'OFFICE_SUPPLIES': 'Office Supplies',
        'OTHER': 'Other',
      };
      expect(ExpenseCategory.values.length, labels.length);
      for (final c in ExpenseCategory.values) {
        expect(labels[c.apiValue], c.label);
        expect(ExpenseCategoryX.fromApi(c.apiValue), c);
      }
      expect(kExpenseCategoryOptions.map((o) => o.$1), labels.keys);
    });
  });

  group('ExpenseAccess (gating matrix)', () {
    test('finance:view alone: analytics yes, add / delete no', () {
      final a = ExpenseAccess(_user(['finance:view']));
      expect(a.canViewAnalytics, isTrue);
      expect(a.canManage, isFalse);
    });

    test('finance:expense-manage unlocks Add and Delete', () {
      final a =
          ExpenseAccess(_user(['finance:view', 'finance:expense-manage']));
      expect(a.canViewAnalytics, isTrue);
      expect(a.canManage, isTrue);
    });

    test('income-manage is not expense-manage; no user means nothing', () {
      final a = ExpenseAccess(_user(['finance:income-manage']));
      expect(a.canViewAnalytics, isFalse);
      expect(a.canManage, isFalse);
      const none = ExpenseAccess(null);
      expect(none.canViewAnalytics, isFalse);
      expect(none.canManage, isFalse);
    });
  });
}
