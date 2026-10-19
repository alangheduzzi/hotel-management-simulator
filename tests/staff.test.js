import test from "node:test";
import assert from "node:assert/strict";
import { addDays, getCashBalance } from "../src/business.js";
import {
  STAFF_DEPARTMENTS,
  createStaffData,
  getStaffMetrics,
  hireEmployee,
  dismissEmployee,
  scheduleShift,
  trainEmployee,
  ensureDailyShifts,
  postDailyPayroll,
  settleEmployeeDay,
} from "../src/staff.js";

function demo(date = "2026-10-16") {
  return {
    date,
    ...createStaffData(date),
    ledger: [],
    activity: [],
    finance: { openingCash: 250000, startDate: date },
  };
}

test("fictional workforce has exactly 50 named employees in the required departments", () => {
  const state = demo();
  const expected = [7, 12, 10, 8, 5, 4, 4];
  assert.equal(state.employees.length, 50);
  assert.equal(
    new Set(state.employees.map((employee) => employee.id)).size,
    50,
  );
  assert.equal(
    new Set(state.employees.map((employee) => employee.name)).size,
    50,
  );
  STAFF_DEPARTMENTS.forEach((department, i) =>
    assert.equal(
      state.employees.filter((employee) => employee.department === department)
        .length,
      expected[i],
    ),
  );
  assert.ok(
    state.employees.every(
      (employee) =>
        employee.name && employee.salary > 0 && employee.status === "active",
    ),
  );
  const metrics = getStaffMetrics(state);
  assert.equal(metrics.headcount, 50);
  assert.equal(
    metrics.monthlyPayroll,
    state.employees.reduce((sum, employee) => sum + employee.salary, 0),
  );
  assert.ok(metrics.coverage > 0 && metrics.coverage <= 1);
  assert.equal(state.shifts.length, 50);
  assert.throws(() => createStaffData("2026-02-30"), /valid/);
});

test("payroll posts employee accruals once per day and uses the actual month length", () => {
  const state = demo();
  const next = postDailyPayroll(state);
  assert.equal(state.ledger.length, 0);
  assert.equal(next.ledger.length, 50);
  assert.ok(
    next.ledger.every(
      (entry) =>
        entry.type === "expense" &&
        entry.category === "payroll" &&
        entry.amount < 0 &&
        entry.cashDelta === entry.amount,
    ),
  );
  const first = state.employees[0];
  assert.equal(
    next.ledger.find((entry) => entry.employeeId === first.id).amount,
    -Math.round((first.salary / 31) * 100) / 100,
  );
  assert.deepEqual(postDailyPayroll(next).ledger, next.ledger);
  const tomorrow = postDailyPayroll({ ...next, date: addDays(state.date, 1) });
  assert.equal(tomorrow.ledger.length, 100);
  assert.deepEqual(tomorrow.ledger.slice(0, 50), next.ledger);
  const february = demo("2027-02-01");
  const feb = postDailyPayroll(february);
  assert.equal(
    feb.ledger[0].amount,
    -Math.round((february.employees[0].salary / 28) * 100) / 100,
  );
  assert.equal(
    getCashBalance(next),
    Math.round(
      (250000 + next.ledger.reduce((sum, entry) => sum + entry.amount, 0)) *
        100,
    ) / 100,
  );
});

test("hiring validates inputs, retains all records, and begins payroll and service tomorrow", () => {
  const state = postDailyPayroll(demo());
  const hired = hireEmployee(state, {
    name: "Nina Archer",
    jobTitle: "Guest Relations Agent",
    department: "Front Office",
    salary: 2900,
  });
  const employee = hired.employees.at(-1);
  assert.equal(state.employees.length, 50);
  assert.equal(hired.employees.length, 51);
  assert.equal(employee.payrollStartsAt, "2026-10-17");
  assert.equal(getStaffMetrics(hired).headcount, 51);
  assert.deepEqual(postDailyPayroll(hired).ledger, state.ledger);
  assert.throws(
    () =>
      scheduleShift(hired, {
        employeeId: employee.id,
        date: state.date,
        shift: "Morning",
      }),
    /tomorrow/,
  );
  const tomorrow = postDailyPayroll({ ...hired, date: "2026-10-17" });
  assert.equal(
    tomorrow.ledger.filter((entry) => entry.employeeId === employee.id).length,
    1,
  );
  assert.throws(
    () =>
      hireEmployee(state, {
        name: "N",
        jobTitle: "Guest Agent",
        department: "Front Office",
        salary: 2900,
      }),
    /name/,
  );
  assert.throws(
    () =>
      hireEmployee(state, {
        name: "Nina Archer",
        jobTitle: "A",
        department: "Front Office",
        salary: 2900,
      }),
    /title/,
  );
  assert.throws(
    () =>
      hireEmployee(state, {
        name: "Nina Archer",
        jobTitle: "Guest Agent",
        department: "Unknown",
        salary: 2900,
      }),
    /department/,
  );
  for (const salary of [-10, 0, 50001, Infinity, NaN])
    assert.throws(
      () =>
        hireEmployee(state, {
          name: "Nina Archer",
          jobTitle: "Guest Agent",
          department: "Front Office",
          salary,
        }),
      /salary/,
    );
});

test("dismissal stops future payroll, preserves historical pay, and measurably affects morale", () => {
  const state = postDailyPayroll(demo());
  const employee = state.employees[0];
  const colleague = state.employees[1];
  const future = scheduleShift(state, {
    employeeId: employee.id,
    date: "2026-10-18",
    shift: "Evening",
  });
  const dismissed = dismissEmployee(future, employee.id);
  assert.equal(dismissed.employees[0].status, "dismissed");
  assert.equal(getStaffMetrics(dismissed).headcount, 49);
  assert.equal(dismissed.employees[1].satisfaction, colleague.satisfaction - 2);
  assert.ok(
    !dismissed.shifts.some(
      (shift) => shift.employeeId === employee.id && shift.date > state.date,
    ),
  );
  assert.deepEqual(dismissed.ledger, state.ledger);
  assert.deepEqual(postDailyPayroll(dismissed).ledger, state.ledger);
  const tomorrow = postDailyPayroll({ ...dismissed, date: "2026-10-17" });
  assert.equal(
    tomorrow.ledger.filter((entry) => entry.date === "2026-10-17").length,
    49,
  );
  assert.equal(
    tomorrow.ledger.filter((entry) => entry.employeeId === employee.id).length,
    1,
  );
  assert.throws(() => dismissEmployee(dismissed, employee.id), /active/);
  assert.throws(() => trainEmployee(dismissed, employee.id), /active/);
  assert.throws(
    () =>
      scheduleShift(dismissed, {
        employeeId: employee.id,
        date: "2026-10-17",
        shift: "Morning",
      }),
    /active/,
  );
});

test("shift scheduling replaces assignments, validates dates, and changes departmental coverage", () => {
  let state = demo();
  const frontOffice = state.employees.filter(
    (employee) => employee.department === "Front Office",
  );
  for (const employee of frontOffice)
    state = scheduleShift(state, {
      employeeId: employee.id,
      date: state.date,
      shift: "Morning",
    });
  assert.equal(getStaffMetrics(state).departments[0].coverage, 1);
  for (const employee of frontOffice)
    state = scheduleShift(state, {
      employeeId: employee.id,
      date: state.date,
      shift: "Off",
    });
  assert.equal(getStaffMetrics(state).departments[0].coverage, 0);
  assert.equal(state.shifts.length, 50);
  const employee = state.employees[0];
  state = scheduleShift(state, {
    employeeId: employee.id,
    date: "2026-10-19",
    shift: "Evening",
  });
  const generated = ensureDailyShifts(state, "2026-10-19");
  assert.equal(
    generated.shifts.find(
      (shift) =>
        shift.employeeId === employee.id && shift.date === "2026-10-19",
    ).shift,
    "Evening",
  );
  assert.deepEqual(
    ensureDailyShifts(generated, "2026-10-19").shifts,
    generated.shifts,
  );
  assert.throws(
    () =>
      scheduleShift(state, {
        employeeId: employee.id,
        date: "2026-10-15",
        shift: "Morning",
      }),
    /Past/,
  );
  assert.throws(
    () =>
      scheduleShift(state, {
        employeeId: employee.id,
        date: "2026-02-30",
        shift: "Morning",
      }),
    /valid/,
  );
  assert.throws(
    () =>
      scheduleShift(state, {
        employeeId: employee.id,
        date: state.date,
        shift: "Double",
      }),
    /valid shift/,
  );
  const paidOff = postDailyPayroll(state);
  assert.ok(
    paidOff.ledger.some(
      (entry) => entry.employeeId === employee.id && entry.amount < 0,
    ),
  );
});

test("training improves performance and satisfaction, with one cost and no duplicate daily course", () => {
  const state = demo();
  const employee = state.employees[0];
  const next = trainEmployee(state, employee.id, "service");
  assert.equal(
    next.employees[0].performance,
    Math.min(100, employee.performance + 8),
  );
  assert.equal(
    next.employees[0].satisfaction,
    Math.min(100, employee.satisfaction + 4),
  );
  assert.equal(next.employees[0].training.length, 1);
  assert.equal(state.employees[0].training.length, 0);
  assert.equal(next.ledger.length, 1);
  assert.deepEqual(
    [
      next.ledger[0].category,
      next.ledger[0].amount,
      next.ledger[0].cashDelta,
      next.ledger[0].department,
    ],
    ["training", -180, -180, "Front Office"],
  );
  assert.throws(
    () => trainEmployee(next, employee.id, "service"),
    /already completed/,
  );
  assert.throws(
    () => trainEmployee(state, employee.id, "imaginary"),
    /valid training/,
  );
  const second = trainEmployee(next, employee.id, "leadership");
  assert.equal(second.ledger.length, 2);
  assert.equal(
    second.ledger.reduce((sum, entry) => sum + entry.amount, 0),
    -430,
  );
  assert.ok(second.employees[0].performance <= 100);
});

test("daily staff settlement changes morale once and off days recover satisfaction", () => {
  let state = demo();
  const employee = state.employees[0];
  state = scheduleShift(state, {
    employeeId: employee.id,
    date: state.date,
    shift: "Off",
  });
  const next = settleEmployeeDay(state);
  assert.equal(
    next.employees[0].satisfaction,
    Math.min(100, employee.satisfaction + 0.6),
  );
  assert.deepEqual(settleEmployeeDay(next), next);
  assert.notEqual(
    next.employees[1].satisfaction,
    state.employees[1].satisfaction,
  );
  assert.equal(state.employees[0].satisfaction, employee.satisfaction);
});
