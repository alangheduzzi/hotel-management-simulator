import { addDays, appendLog, postEntry, roundMoney } from "./business.js";

export const STAFF_DEPARTMENTS = [
  "Front Office",
  "Housekeeping",
  "Restaurant & Bar",
  "Kitchen",
  "Maintenance",
  "Spa & Wellness",
  "Management",
];
export const SHIFT_OPTIONS = ["Morning", "Evening", "Night", "Off"];
export const TRAINING_COURSES = [
  {
    id: "service",
    name: "Luxury service",
    cost: 180,
    performance: 8,
    satisfaction: 4,
  },
  {
    id: "safety",
    name: "Safety & operations",
    cost: 140,
    performance: 5,
    satisfaction: 3,
  },
  {
    id: "leadership",
    name: "Leadership",
    cost: 250,
    performance: 6,
    satisfaction: 6,
  },
];

const ROSTER = [
  [
    "Front Office",
    [
      "Front Office Manager",
      "Guest Relations Supervisor",
      "Concierge",
      "Receptionist",
      "Receptionist",
      "Night Auditor",
      "Porter",
    ],
    [4800, 3700, 3200, 2800, 2800, 3100, 2400],
  ],
  [
    "Housekeeping",
    [
      "Executive Housekeeper",
      "Floor Supervisor",
      "Floor Supervisor",
      "Room Attendant",
      "Room Attendant",
      "Room Attendant",
      "Room Attendant",
      "Room Attendant",
      "Room Attendant",
      "Laundry Attendant",
      "Laundry Attendant",
      "Public Area Attendant",
    ],
    [4200, 2900, 2900, 2300, 2300, 2300, 2300, 2300, 2300, 2200, 2200, 2200],
  ],
  [
    "Restaurant & Bar",
    [
      "Restaurant Manager",
      "Maître d'hôtel",
      "Sommelier",
      "Bartender",
      "Bartender",
      "Server",
      "Server",
      "Server",
      "Room Service Attendant",
      "Room Service Attendant",
    ],
    [4600, 3500, 3400, 2900, 2900, 2500, 2500, 2500, 2400, 2400],
  ],
  [
    "Kitchen",
    [
      "Executive Chef",
      "Sous Chef",
      "Pastry Chef",
      "Chef de Partie",
      "Chef de Partie",
      "Commis Chef",
      "Kitchen Steward",
      "Kitchen Steward",
    ],
    [6200, 4400, 3600, 3100, 3100, 2500, 2200, 2200],
  ],
  [
    "Maintenance",
    [
      "Chief Engineer",
      "Maintenance Technician",
      "Electrician",
      "Plumber",
      "Groundskeeper",
    ],
    [4500, 3100, 3100, 3000, 2500],
  ],
  [
    "Spa & Wellness",
    ["Spa Manager", "Spa Therapist", "Spa Therapist", "Fitness Instructor"],
    [4000, 2900, 2900, 2800],
  ],
  [
    "Management",
    [
      "General Manager",
      "Finance Manager",
      "Human Resources Manager",
      "Sales & Marketing Manager",
    ],
    [8200, 5200, 4700, 4600],
  ],
];
const NAMES = [
  "Adrian Vale",
  "Elena Marlow",
  "Julian Ashford",
  "Clara Moretti",
  "Theo Laurent",
  "Nadia Ellis",
  "Oscar Silva",
  "Mira Beaumont",
  "Gabriel Stone",
  "Lucia Hart",
  "Amara Cole",
  "Rafael Costa",
  "Iris Bennett",
  "Luca Monroe",
  "Eva Sinclair",
  "Jonah Reed",
  "Freya Morgan",
  "Dario Bell",
  "Leila Chen",
  "Noah Ellis",
  "Vivienne Brooks",
  "Sebastian Hale",
  "Alina Rossi",
  "Mateo Finch",
  "Camille Ward",
  "Hugo Turner",
  "Sienna Blake",
  "Felix Gray",
  "Maya Pierce",
  "Arthur Voss",
  "Isabel Duarte",
  "Nico James",
  "Sophie Arden",
  "Leo March",
  "Zara Quinn",
  "Elias Grant",
  "Mila Hayes",
  "Rohan West",
  "Oliver Kent",
  "Anika Rose",
  "Emil North",
  "Chiara Fox",
  "Samuel Rowan",
  "Daphne Wells",
  "Aria Bellamy",
  "Finn Rhodes",
  "Layla Winter",
  "Alexander Vale",
  "Ophelia Frost",
  "Daniel Sloane",
];
const BASE_REQUIRED = {
  "Front Office": 5,
  Housekeeping: 8,
  "Restaurant & Bar": 7,
  Kitchen: 5,
  Maintenance: 3,
  "Spa & Wellness": 3,
  Management: 3,
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const clone = (state) => structuredClone(state);
const mean = (items, key) =>
  items.length
    ? items.reduce((total, item) => total + item[key], 0) / items.length
    : 0;

function requireDate(date) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  )
    throw new Error("Choose a valid shift date.");
}
function activeEmployee(state, id) {
  const employee = state.employees.find((item) => item.id === id);
  if (!employee || employee.status !== "active")
    throw new Error("Choose an active employee.");
  return employee;
}
function dailySalary(employee, date) {
  const [year, month] = date.split("-").map(Number);
  return roundMoney(
    employee.salary / new Date(Date.UTC(year, month, 0)).getUTCDate(),
  );
}
function log(state, title, detail) {
  appendLog(state, title, detail, "staff");
}
function defaultShift(employee, index, date) {
  const ordinal = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  if ((index + ordinal) % 7 >= 5) return "Off";
  if (
    employee.department === "Management" ||
    employee.department === "Housekeeping" ||
    employee.department === "Maintenance" ||
    employee.department === "Spa & Wellness"
  )
    return "Morning";
  if (employee.jobTitle === "Night Auditor") return "Night";
  return index % 2 ? "Evening" : "Morning";
}

export function createStaffData(date) {
  requireDate(date);
  let index = 0;
  const employees = ROSTER.flatMap(([department, titles, salaries]) =>
    titles.map((jobTitle, position) => {
      const i = index++;
      return {
        id: `EMP-${String(i + 1).padStart(3, "0")}`,
        name: NAMES[i],
        department,
        jobTitle,
        salary: salaries[position],
        status: "active",
        satisfaction: 75 + (i % 16),
        performance: 76 + ((i * 3) % 19),
        training: [],
        hiredAt: addDays(date, -365 - i * 7),
        payrollStartsAt: addDays(date, -365 - i * 7),
      };
    }),
  );
  return {
    employees,
    shifts: employees.map((employee, i) => ({
      id: `shift-${date}-${employee.id}`,
      employeeId: employee.id,
      date,
      shift: defaultShift(employee, i, date),
    })),
  };
}

export function hireEmployee(state, input) {
  const name = String(input.name || "").trim();
  const jobTitle = String(input.jobTitle || "").trim();
  const salary = Number(input.salary);
  if (name.length < 2 || name.length > 80)
    throw new Error("Enter an employee name between 2 and 80 characters.");
  if (jobTitle.length < 2 || jobTitle.length > 80)
    throw new Error("Enter a job title between 2 and 80 characters.");
  if (!STAFF_DEPARTMENTS.includes(input.department))
    throw new Error("Choose a valid department.");
  if (!Number.isFinite(salary) || salary < 1000 || salary > 50000)
    throw new Error("Monthly salary must be between $1,000 and $50,000.");
  const next = clone(state);
  const sequence =
    Math.max(
      0,
      ...next.employees.map(
        (employee) => Number(employee.id.replace(/^EMP-/, "")) || 0,
      ),
    ) + 1;
  const employee = {
    id: `EMP-${String(sequence).padStart(3, "0")}`,
    name,
    jobTitle,
    department: input.department,
    salary: roundMoney(salary),
    status: "active",
    satisfaction: 85,
    performance: 72,
    training: [],
    hiredAt: state.date,
    payrollStartsAt: addDays(state.date, 1),
  };
  next.employees.push(employee);
  next.shifts.push({
    id: `shift-${state.date}-${employee.id}`,
    employeeId: employee.id,
    date: state.date,
    shift: "Off",
  });
  log(
    next,
    "Employee hired",
    `${name} joins ${input.department}. Payroll and scheduled service begin tomorrow.`,
  );
  return next;
}

export function dismissEmployee(state, id) {
  const employee = activeEmployee(state, id);
  const next = clone(state);
  Object.assign(
    next.employees.find((item) => item.id === id),
    { status: "dismissed", dismissedAt: state.date },
  );
  next.shifts = next.shifts.filter(
    (shift) => shift.employeeId !== id || shift.date <= state.date,
  );
  for (const colleague of next.employees.filter(
    (item) =>
      item.status === "active" && item.department === employee.department,
  ))
    colleague.satisfaction = clamp(colleague.satisfaction - 2, 0, 100);
  log(
    next,
    "Employee dismissed",
    `${employee.name} leaves ${employee.department}. Future payroll stops; recognized pay is retained. No severance is charged in this demo.`,
  );
  return next;
}

export function scheduleShift(state, input) {
  const employee = activeEmployee(state, input.employeeId);
  requireDate(input.date);
  if (input.date < state.date)
    throw new Error("Past shifts are closed; choose today or a future date.");
  if (!SHIFT_OPTIONS.includes(input.shift))
    throw new Error("Choose a valid shift.");
  if (employee.payrollStartsAt > input.date && input.shift !== "Off")
    throw new Error("New hires begin scheduled service tomorrow.");
  const next = clone(state);
  next.shifts = next.shifts.filter(
    (shift) =>
      shift.employeeId !== input.employeeId || shift.date !== input.date,
  );
  next.shifts.push({
    id: `shift-${input.date}-${input.employeeId}`,
    employeeId: input.employeeId,
    date: input.date,
    shift: input.shift,
  });
  log(
    next,
    "Shift updated",
    `${employee.name}: ${input.shift}, ${input.date}.`,
  );
  return next;
}

export function trainEmployee(state, id, training = "service") {
  const employee = activeEmployee(state, id);
  const course = TRAINING_COURSES.find(
    (item) =>
      item.id === (typeof training === "object" ? training.id : training),
  );
  if (!course) throw new Error("Choose a valid training course.");
  const entryId = `training-${state.date}-${id}-${course.id}`;
  if (employee.training.some((item) => item.id === entryId))
    throw new Error("This employee has already completed this course today.");
  const next = clone(state);
  const trainee = next.employees.find((item) => item.id === id);
  trainee.performance = clamp(trainee.performance + course.performance, 0, 100);
  trainee.satisfaction = clamp(
    trainee.satisfaction + course.satisfaction,
    0,
    100,
  );
  trainee.training.push({
    id: entryId,
    date: state.date,
    course: course.id,
    name: course.name,
    cost: course.cost,
  });
  postEntry(next, {
    id: entryId,
    date: state.date,
    type: "expense",
    category: "training",
    department: employee.department,
    amount: -course.cost,
    cashDelta: -course.cost,
    description: `${course.name}: ${employee.name}`,
    employeeId: id,
  });
  log(
    next,
    "Training completed",
    `${employee.name}: ${course.name}. $${course.cost} charged; performance +${course.performance}, satisfaction +${course.satisfaction} (maximum 100).`,
  );
  return next;
}

export function ensureDailyShifts(state, date = state.date) {
  requireDate(date);
  const next = clone(state);
  next.employees.forEach((employee, index) => {
    if (
      employee.status !== "active" ||
      employee.payrollStartsAt > date ||
      next.shifts.some(
        (shift) => shift.date === date && shift.employeeId === employee.id,
      )
    )
      return;
    next.shifts.push({
      id: `shift-${date}-${employee.id}`,
      employeeId: employee.id,
      date,
      shift: defaultShift(employee, index, date),
    });
  });
  return next;
}

export function postDailyPayroll(state) {
  const next = clone(state);
  for (const employee of next.employees) {
    if (employee.status !== "active" || employee.payrollStartsAt > state.date)
      continue;
    const amount = -dailySalary(employee, state.date);
    postEntry(next, {
      id: `payroll-${state.date}-${employee.id}`,
      date: state.date,
      type: "expense",
      category: "payroll",
      department: employee.department,
      amount,
      cashDelta: amount,
      description: `Salary accrual: ${employee.name}`,
      employeeId: employee.id,
    });
  }
  return next;
}

export function getStaffMetrics(state) {
  const active = (state.employees || []).filter(
    (employee) => employee.status === "active",
  );
  const eligible = active.filter(
    (employee) =>
      !employee.payrollStartsAt || employee.payrollStartsAt <= state.date,
  );
  const scheduled = new Set(
    (state.shifts || [])
      .filter((shift) => shift.date === state.date && shift.shift !== "Off")
      .map((shift) => shift.employeeId),
  );
  const departments = STAFF_DEPARTMENTS.map((department) => {
    const members = active.filter(
      (employee) => employee.department === department,
    );
    const working = eligible.filter(
      (employee) =>
        employee.department === department && scheduled.has(employee.id),
    );
    const required = BASE_REQUIRED[department];
    return {
      department,
      headcount: members.length,
      scheduled: working.length,
      required,
      coverage: Math.min(1, working.length / required),
      dailyPayroll: roundMoney(
        members
          .filter(
            (employee) =>
              !employee.payrollStartsAt ||
              employee.payrollStartsAt <= state.date,
          )
          .reduce(
            (sum, employee) => sum + dailySalary(employee, state.date),
            0,
          ),
      ),
      monthlyPayroll: roundMoney(
        members.reduce((sum, employee) => sum + employee.salary, 0),
      ),
      satisfaction: roundMoney(mean(members, "satisfaction")),
      performance: roundMoney(mean(members, "performance")),
    };
  });
  const required = departments.reduce(
    (sum, department) => sum + department.required,
    0,
  );
  return {
    headcount: active.length,
    monthlyPayroll: roundMoney(
      active.reduce((sum, employee) => sum + employee.salary, 0),
    ),
    dailyPayroll: roundMoney(
      departments.reduce((sum, department) => sum + department.dailyPayroll, 0),
    ),
    satisfaction: roundMoney(mean(active, "satisfaction")),
    performance: roundMoney(mean(active, "performance")),
    scheduled: departments.reduce(
      (sum, department) => sum + department.scheduled,
      0,
    ),
    required,
    coverage:
      departments.reduce(
        (sum, department) =>
          sum + Math.min(department.scheduled, department.required),
        0,
      ) / required,
    departments,
  };
}

export function settleEmployeeDay(state) {
  if (state.staffSettledThrough === state.date) return state;
  const next = ensureDailyShifts(state);
  const metrics = getStaffMetrics(next);
  for (const employee of next.employees.filter(
    (item) => item.status === "active",
  )) {
    const department = metrics.departments.find(
      (item) => item.department === employee.department,
    );
    const shift = next.shifts.find(
      (item) => item.employeeId === employee.id && item.date === state.date,
    );
    const working = shift && shift.shift !== "Off";
    employee.satisfaction = roundMoney(
      clamp(
        employee.satisfaction +
          (working ? (department.coverage < 0.75 ? -1.2 : -0.15) : 0.6),
        0,
        100,
      ),
    );
    employee.performance = roundMoney(
      clamp(
        employee.performance + (employee.satisfaction < 40 ? -0.35 : 0.05),
        0,
        100,
      ),
    );
  }
  next.staffSettledThrough = state.date;
  return next;
}
