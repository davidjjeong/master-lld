export type MasteryPrompt = {
  brief: string;
  requirements: string;
  entities: string;
  classDesign: string;
  implementation: string;
  extensibility: string;
};

export type MasteryStep = "Requirements" | "Entities" | "Class design" | "Implementation" | "Extensibility";
export type RubricImportance = "core" | "supporting";
export type RubricCriterion = {
  id: string;
  label: string;
  importance: RubricImportance;
  acceptableEvidence: string;
  commonMisreadings: string;
};

export const masteryPrompts: Record<string, MasteryPrompt> = {
  "Amazon Locker": {
    brief: "Design a locker system like Amazon Locker where delivery drivers deposit packages and customers pick them up using a code.",
    requirements: "Confirm deposit and pickup flows, SMALL/MEDIUM/LARGE exact-size matching, occupied-compartment rejection, seven-day code expiry, invalid or expired code behavior, successful pickup cleanup, and manager removal/UI out of scope.",
    entities: "Expect Locker to orchestrate, Compartment to own size and occupancy, AccessCode to own the code/expiry and compartment reference, with Driver and Customer as actors rather than unnecessary state holders.",
    classDesign: "Expect depositPackage(packageSize) and retrievePackage(code), clear return/failure behavior, and state transitions that keep compartment occupancy and code validity consistent.",
    implementation: "Trace matching an available compartment, marking it occupied, generating a code, validating lookup and seven-day expiry, and freeing the compartment only after a valid pickup.",
    extensibility: "Discuss one focused change such as size fallback, broken compartments, or deposit confirmation; identify the affected state/API and preserve the simple deposit/pickup flow.",
  },
  "Parking Lot": {
    brief: "Design a parking lot with multiple levels, vehicle and spot types, entry tickets, parking, and exit.",
    requirements: "Confirm compatible vehicle/spot types, allocation preference, full-lot behavior, ticket creation, exit, fee scope, and reservation/payment scope. Unless the candidate explicitly chooses exact matching, a spot is compatible when it is the same size or larger than the vehicle; allocate the smallest compatible available spot. Thus a motorcycle may use COMPACT, MEDIUM, or LARGE, with MEDIUM/LARGE as valid fallback when smaller spots are unavailable.",
    entities: "Expect ParkingLot, Level, Spot, Vehicle, and Ticket with the lot/level owning availability and the ticket linking a parked vehicle to a spot.",
    classDesign: "Expect park(vehicle) and unpark(ticketId), an allocation policy that can change, and clear ownership of occupancy and pricing. Accept a helper or availability collection as the owner of free-spot bookkeeping.",
    implementation: "Trace finding the smallest compatible spot, issuing a ticket, rejecting a full lot, and freeing the spot on exit. Removing a selected spot from a free-spot queue/map during allocation is already the availability update; do not require park() to add it back. Verify that the availability structure is initialized from the configured spots before the first request.",
    extensibility: "Discuss reservations, a new vehicle type, or a different allocation policy through a focused policy/state change rather than rewriting ParkingLot.",
  },
  "Elevator System": {
    brief: "Design an elevator system for a building that receives floor requests and moves elevators safely and efficiently.",
    requirements: "Confirm building floors, request types, invalid/duplicate requests, door safety, movement completion, and the expected scheduling scope.",
    entities: "Expect Elevator to own position/direction/door state, Controller to coordinate requests, and Request to represent pending work.",
    classDesign: "Expect request handling, next-stop selection, safe state transitions, and a replaceable dispatching policy without overdesigning hardware.",
    implementation: "Trace accepting a request, selecting an elevator/stop, moving safely, opening/closing doors, and completing the request.",
    extensibility: "Discuss multiple elevators or a new dispatch policy while keeping elevator state and the controller boundary stable.",
  },
  "Vending Machine": {
    brief: "Design a vending machine that lets customers select products, pay, receive change, and handles inventory and failed purchases.",
    requirements: "Confirm product selection, inventory, payment, insufficient funds, change/refund, cancellation, and out-of-stock behavior.",
    entities: "Expect VendingMachine, Product, Inventory, Payment/Transaction, and an explicit owner for purchase state.",
    classDesign: "Expect small operations for selection, payment, dispense, and refund, with transaction state preventing an invalid dispense.",
    implementation: "Trace validating selection and inventory, accepting sufficient payment, dispensing exactly once, returning change, and refunding cancellation.",
    extensibility: "Discuss a new payment method or recipe/product type behind a stable transaction boundary.",
  },
  "Tic-Tac-Toe": {
    brief: "Design a two-player Tic-Tac-Toe game with alternating turns, valid moves, win/draw detection, and reset.",
    requirements: "Confirm board size, turn order, occupied-cell rejection, win/draw rules, game-over behavior, and reset scope.",
    entities: "Expect Game to own turn/status, Board to own cells and win checks, and Player to represent participants.",
    classDesign: "Expect makeMove, board state, current player, winner/status, and rules kept close to the state they protect.",
    implementation: "Trace rejecting an illegal move, placing a mark, checking relevant win lines, detecting a draw, and switching turns.",
    extensibility: "Discuss configurable board size or connect-N through a rule/board change while preserving the game lifecycle.",
  },
  "Rate Limiter": {
    brief: "Design a rate limiter that limits requests per client according to a configurable time-based policy.",
    requirements: "Confirm client identity, limit/window or token rule, allow/reject result, time behavior, invalid configuration, and scope of shared/distributed state.",
    entities: "Expect RateLimiter configuration, per-client state, and a Clock/time source with clear ownership of request history or tokens.",
    classDesign: "Expect allow(clientId), encapsulated client state, a policy boundary, and explicit behavior at the limit.",
    implementation: "Trace calculating availability, accepting and recording a request, rejecting over-limit calls, and advancing/refilling state over time.",
    extensibility: "Discuss swapping fixed-window/token-bucket policy or adding a storage adapter without changing the caller API.",
  },
  "Connect Four": {
    brief: "Design a two-player Connect Four game where players drop pieces into columns and win by connecting four pieces.",
    requirements: "Confirm board dimensions, turn order, full-column rejection, connected-four directions, draw, and game-over behavior.",
    entities: "Expect Game to own lifecycle, Board to own cells and win checks, and Player/Piece to represent marks.",
    classDesign: "Expect dropPiece(column), board state, current player, and a focused rule-checking responsibility.",
    implementation: "Trace dropping to the lowest open cell, rejecting invalid moves, checking horizontal/vertical/diagonal lines, and ending the game.",
    extensibility: "Discuss configurable board size or connect-N as a rule/configuration change.",
  },
  "Library Management": {
    brief: "Design a library management system for books, members, borrowing, returning, and availability.",
    requirements: "Confirm copies versus titles, member eligibility/limits, borrow/return rules, overdue policy, reservations, and search scope.",
    entities: "Expect Library, Book, BookCopy, Member, Loan, and optionally Reservation, with each copy owning its availability state.",
    classDesign: "Expect borrowBook and returnBook with eligibility and availability rules kept near the responsible service/entity.",
    implementation: "Trace checking eligibility and an available copy, creating a loan, returning the copy, and rejecting invalid or duplicate loans.",
    extensibility: "Discuss reservations or renewals without coupling those policies to the physical BookCopy state.",
  },
  "Coffee Machine": {
    brief: "Design a coffee machine that supports drink recipes, ingredients, payment, change, and dispensing.",
    requirements: "Confirm recipes, ingredient quantities, payment/change, unavailable drinks, cancellation/refund, and cleaning/hardware scope.",
    entities: "Expect CoffeeMachine, Recipe, IngredientInventory, Payment, and Order/Transaction with clear state ownership.",
    classDesign: "Expect recipe selection, inventory checks, payment state, dispense, and refund operations without a giant conditional.",
    implementation: "Trace validating ingredients and payment before dispensing, decrementing inventory, returning change, and handling cancellation.",
    extensibility: "Discuss adding a recipe or payment method through data/configuration or a stable strategy boundary.",
  },
  "ATM": {
    brief: "Design an ATM that authenticates a card and PIN and supports balance checks, withdrawals, deposits, and cancellation.",
    requirements: "Confirm authentication attempts, supported transactions, balance/cash limits, invalid inputs, cancellation, and transaction atomicity.",
    entities: "Expect ATM, Card, Account, CashDispenser, and Transaction, separating account state from machine cash state.",
    classDesign: "Expect authentication and transaction methods with explicit states and no partial balance/cash update.",
    implementation: "Trace authenticating, validating funds and available denominations, dispensing atomically, and handling failure/cancellation safely.",
    extensibility: "Discuss a new transaction or account type through a focused transaction boundary, not ATM conditionals everywhere.",
  },
  "Movie Ticket Booking": {
    brief: "Design a movie ticket booking system with theaters, showtimes, seat selection, reservations, confirmation, and cancellation.",
    requirements: "Confirm showtime search, seat availability, temporary holds, confirmation, cancellation, expiry, and double-booking behavior.",
    entities: "Expect Theater/Screen, Movie/Show, Seat, Booking, and Customer with the show owning seat state for a particular time.",
    classDesign: "Expect search, hold, confirm, and cancel methods with explicit seat-state transitions.",
    implementation: "Trace checking and holding seats, confirming a booking, rejecting conflicts, and releasing seats on cancellation/expiry.",
    extensibility: "Discuss temporary holds or pricing tiers without mixing them into the core seat-availability invariant.",
  },
  "Hotel Booking": {
    brief: "Design a hotel booking system that searches rooms by dates, creates reservations, prevents overlap, and supports cancellation.",
    requirements: "Confirm room types, date boundaries, availability, overlapping reservations, cancellation, guest limits, and pricing scope.",
    entities: "Expect Hotel, Room, RoomType, Guest, and Reservation with the reservation owning a date range.",
    classDesign: "Expect searchAvailable, reserve, and cancel operations with overlap validation isolated from pricing.",
    implementation: "Trace finding a compatible room, rejecting date overlap, creating a reservation, and restoring availability on cancellation.",
    extensibility: "Discuss pricing, upgrades, or multiple properties without coupling those policies to date-range availability.",
  },
  "Splitwise": {
    brief: "Design an expense-sharing system like Splitwise that records group expenses and calculates who owes whom.",
    requirements: "Confirm group membership, equal/fixed/percentage shares, validation, balances, settlement, and rounding behavior.",
    entities: "Expect Group, User, Expense, Split, and Balance with the expense owning its contribution breakdown.",
    classDesign: "Expect addExpense, calculateBalances, and settle with a replaceable split calculation boundary.",
    implementation: "Trace validating participants and shares, recording an expense, updating net balances, and settling an amount.",
    extensibility: "Discuss percentage or itemized splits without changing the expense lifecycle or balance representation.",
  },
  "File System": {
    brief: "Design an in-memory file system with files, directories, paths, creation, lookup, and listing operations.",
    requirements: "Confirm supported operations, absolute/relative paths, duplicate names, invalid paths, file/directory distinctions, and persistence scope.",
    entities: "Expect FileSystem/PathResolver plus a common FileSystemNode abstraction with Directory owning children and File owning content.",
    classDesign: "Expect create, resolve, list, and delete behavior with path traversal and parent-child invariants encapsulated.",
    implementation: "Trace resolving path components, creating the node, listing children, and rejecting invalid or duplicate operations.",
    extensibility: "Discuss permissions or symbolic links while keeping path resolution and node ownership understandable.",
  },
  "Logger Framework": {
    brief: "Design a logging framework with log levels, formatting, and pluggable handlers or destinations.",
    requirements: "Confirm levels, filtering, formatting, multiple handlers, handler failures, and configuration scope.",
    entities: "Expect Logger, LogRecord, Formatter, Handler, and level/configuration ownership.",
    classDesign: "Expect log methods, a handler interface, level filtering, and formatting separated cleanly.",
    implementation: "Trace creating a record, filtering below-level messages, formatting accepted records, and delivering to handlers.",
    extensibility: "Discuss asynchronous handlers or a new destination without changing logger call sites.",
  },
  "Notification Service": {
    brief: "Design a notification service that sends messages through channels according to user preferences and records delivery status.",
    requirements: "Confirm notification types, user preferences, supported channels, fallback/retry, delivery status, and failure scope.",
    entities: "Expect NotificationService, Notification, UserPreference, Channel, and DeliveryAttempt with channel behavior behind an interface.",
    classDesign: "Expect send, preference lookup, channel selection, status, and failure/retry boundaries.",
    implementation: "Trace choosing an enabled channel, sending, recording success/failure, and isolating a channel failure.",
    extensibility: "Discuss a new channel or fallback policy through injection/strategy while keeping callers stable.",
  },
  "Car Rental": {
    brief: "Design a car rental system that searches vehicles, creates reservations, supports pickup and return, and tracks availability.",
    requirements: "Confirm vehicle categories, time-range availability, reservation overlap, pickup/return lifecycle, cancellation, and pricing scope.",
    entities: "Expect RentalService, Vehicle, Customer, Reservation, and Branch with reservations owning the time interval.",
    classDesign: "Expect search, reserve, checkout, return, and cancellation methods with lifecycle validation.",
    implementation: "Trace finding a vehicle, preventing overlap, creating a reservation, checking out, and returning it safely.",
    extensibility: "Discuss vehicle categories or one-way returns without changing the reservation invariant.",
  },
  "Pub-Sub System": {
    brief: "Design a publish-subscribe system where consumers subscribe to topics and receive published messages.",
    requirements: "Confirm topics, subscription lifecycle, delivery semantics, duplicate subscriptions, ordering, and consumer failure policy.",
    entities: "Expect Broker, Topic, Subscriber, and Message with topics/broker owning subscription relationships.",
    classDesign: "Expect subscribe, unsubscribe, publish, and a clear subscriber delivery contract with failure isolation.",
    implementation: "Trace snapshotting current subscribers, delivering a message, handling a failing consumer, and preserving subscriptions.",
    extensibility: "Discuss retry/dead-letter behavior without blocking unrelated subscribers or changing the publish API.",
  },
  "Task Scheduler": {
    brief: "Design a task scheduler that queues tasks, selects eligible work, supports cancellation, priorities, and retries.",
    requirements: "Confirm task states, scheduling time, priority, cancellation, execution result, retry limit/backoff, and worker scope.",
    entities: "Expect Scheduler, Task, Queue, Worker, Clock, and RetryPolicy with Task owning lifecycle state.",
    classDesign: "Expect submit, cancel, nextTask, execute, and retry behavior with selection policy replaceable.",
    implementation: "Trace selecting an eligible task, transitioning it to running/completed, cancelling safely, and retrying bounded failures.",
    extensibility: "Discuss recurring tasks or a new priority policy without changing one-time task execution.",
  },
  "Payment Processor": {
    brief: "Design a payment processor that handles idempotent payment attempts, transaction states, provider responses, and refunds.",
    requirements: "Confirm payment lifecycle, idempotency key, provider failure/pending behavior, duplicate requests, refund eligibility, and scope.",
    entities: "Expect PaymentService, Payment, PaymentMethod, Provider, Refund, and an owner for transaction state.",
    classDesign: "Expect create/authorize/capture/refund behavior, idempotency, and a provider adapter boundary.",
    implementation: "Trace creating an idempotent attempt, handling provider results, preventing duplicate charges, and making refunds safe.",
    extensibility: "Discuss adding a second provider without duplicating lifecycle or idempotency rules.",
  },
  "Feed Generator": {
    brief: "Design a feed generator that gathers posts from followed authors, ranks them, and returns paginated results.",
    requirements: "Confirm authorship/following, eligible posts, ranking rules, pagination, empty results, and refresh scope.",
    entities: "Expect FeedService, User, Author, Post, and RankingStrategy with feed composition separate from ranking.",
    classDesign: "Expect generate, pagination, source filtering, and a ranking interface with clear ownership.",
    implementation: "Trace collecting eligible posts, ranking them, returning a page/cursor, and handling no results.",
    extensibility: "Discuss a chronological or popularity ranking policy without changing the feed API.",
  },
  "Inventory Management": {
    brief: "Design an inventory management system that tracks stock, reservations, restocking, cancellation, and fulfillment.",
    requirements: "Confirm SKU quantities, reservation versus available stock, insufficient quantity, release, fulfillment, restocking, and invalid order state.",
    entities: "Expect Inventory, SKU/StockLevel, Reservation, and Order with one clear owner for quantity invariants.",
    classDesign: "Expect reserve, release, fulfill, and restock methods that preserve available/reserved/on-hand relationships.",
    implementation: "Trace atomically reserving quantity, rejecting insufficient stock, releasing on cancellation, and decrementing on fulfillment.",
    extensibility: "Discuss multiple warehouses without duplicating reservation behavior or weakening quantity invariants.",
  },
  "Ride Sharing": {
    brief: "Design a ride-sharing system that requests rides, matches riders with drivers, and tracks trip lifecycle.",
    requirements: "Confirm ride request, driver eligibility/matching, acceptance, start/complete/cancel states, location scope, and pricing scope.",
    entities: "Expect Rider, Driver, Ride, Location, and RideService with the ride owning lifecycle state and matching behind a policy.",
    classDesign: "Expect request, match, accept, start, complete, and cancel methods with invalid transitions rejected.",
    implementation: "Trace requesting a ride, matching a driver, enforcing state transitions, and handling cancellation.",
    extensibility: "Discuss pooled rides or a new matching policy without changing the core ride lifecycle.",
  },
  "Food Delivery": {
    brief: "Design a food delivery system with restaurants, menus, orders, restaurant acceptance, and delivery status.",
    requirements: "Confirm menu availability, order creation, restaurant accept/reject, payment boundary, courier states, cancellation, and invalid updates.",
    entities: "Expect Restaurant, MenuItem, Order, Customer, Courier, and OrderService with Order owning status.",
    classDesign: "Expect createOrder, accept/reject, assignCourier, cancel, and status transitions with ownership clear.",
    implementation: "Trace validating menu items, creating an order, accepting/rejecting it, assigning delivery, and rejecting invalid updates.",
    extensibility: "Discuss multi-restaurant checkout without breaking order ownership and status transitions.",
  },
  "Subscription Billing": {
    brief: "Design a subscription billing system with plans, renewals, payment failures, invoices, and cancellation.",
    requirements: "Confirm plans, billing period, renewal, failed payment, invoice state, cancellation timing, trials, and no-charge-after-cancel behavior.",
    entities: "Expect BillingService, Plan, Customer, Subscription, Invoice, and Payment with Subscription owning lifecycle.",
    classDesign: "Expect subscribe, renew, cancel, charge, and invoice transitions separated from payment-provider details.",
    implementation: "Trace subscribing, renewing after successful payment, recording failure, and cancelling without a later charge.",
    extensibility: "Discuss trials or plan changes without duplicating renewal logic or corrupting invoice state.",
  },
};

const genericMasteryPrompt: MasteryPrompt = {
  brief: "Design the named object-oriented system with a focused core workflow.",
  requirements: "Confirm the core operations, success/failure rules, lifecycle, and scope boundaries.",
  entities: "Identify stateful entities, the orchestrator, relationships, and ownership.",
  classDesign: "Define state, public methods, return values, and encapsulated rules.",
  implementation: "Trace the happy path and the most important invalid state or edge case.",
  extensibility: "Discuss one realistic follow-up and the smallest change that supports it.",
};

export function getMasteryPrompt(problem: string) {
  return masteryPrompts[problem] || genericMasteryPrompt;
}

function criterionId(step: MasteryStep, text: string, index: number) {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  return `${step.toLowerCase().replace(/[^a-z]+/g, "-")}-${slug || index + 1}`;
}

function splitRubricText(text: string) {
  return text
    .split(/,\s*/)
    .map((part) => part.trim().replace(/\.$/, ""))
    .filter((part) => part.length > 0);
}

function rubricParts(step: MasteryStep, text: string) {
  // Extensibility is intentionally one open-ended criterion. Commas in its
  // sentence describe alternative follow-ups and should not become separate
  // requirements that the candidate must all implement.
  if (step === "Extensibility") return [text.trim().replace(/\.$/, "")];
  return splitRubricText(text);
}

/**
 * Derive the review criteria from the same per-problem mastery record used by
 * the interviewer. Keeping this conversion here prevents the API route from
 * maintaining a second, drifting answer key.
 */
export function getRubricCriteria(problem: string, step: MasteryStep): RubricCriterion[] {
  const mastery = getMasteryPrompt(problem);
  const source = step === "Requirements" ? mastery.requirements
    : step === "Entities" ? mastery.entities
      : step === "Class design" ? mastery.classDesign
        : step === "Implementation" ? mastery.implementation
          : mastery.extensibility;
  return rubricParts(step, source).map((text, index) => ({
    id: criterionId(step, text, index),
    label: text,
    importance: index < 2 ? "core" : "supporting",
    acceptableEvidence: text,
    commonMisreadings: "Do not require this exact wording when the candidate communicates the same behavior through a method, state transition, helper, or comment.",
  }));
}

export function formatRubricContext(problem: string, step: MasteryStep) {
  return getRubricCriteria(problem, step)
    .map((criterion) => `- ${criterion.id} [${criterion.importance}]: ${criterion.label}\n  Accept reasonable evidence such as: ${criterion.acceptableEvidence}\n  Avoid false positives: ${criterion.commonMisreadings}`)
    .join("\n");
}

export function formatClarificationContext(problem: string) {
  const mastery = getMasteryPrompt(problem);
  return `Problem brief: ${mastery.brief}\nConfirmed requirement direction: ${mastery.requirements}`;
}

export function formatMasteryContext(problem: string) {
  const prompt = getMasteryPrompt(problem);
  return `Mastery prompt for ${problem}\nProblem brief: ${prompt.brief}\nRequirements: ${prompt.requirements}\nEntities & Relationships: ${prompt.entities}\nClass Design: ${prompt.classDesign}\nImplementation: ${prompt.implementation}\nExtensibility: ${prompt.extensibility}`;
}
