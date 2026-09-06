/**
 * Middleware to validate trip budget calculation request body.
 * Runs before budgetController.
 *
 * Validation rules:
 * - Reject with 400 if budgetINR is missing, not a number, or <= 0
 * - Reject with 400 if travellers is missing, not a number, or <= 0
 * - Reject with 400 if days is missing, not a number, or <= 0
 * - Reject with 400 if any provided cost field is negative
 * - Optional category objects (hotel, food, activities, localTransport, transport) can be missing
 *
 * Error response shape:
 * { "error": true, "message": "<clear description of what's wrong>" }
 */
export function validateBudgetInput(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== "object") {
    return res.status(400).json({
      error: true,
      message: "Request body is required and must be a valid JSON object",
    });
  }

  // Default optional top-level fields to null if not provided
  if (body.tripId === undefined) {
    body.tripId = null;
  }
  if (body.destId === undefined) {
    body.destId = null;
  }

  const { budgetINR, travellers, days, transport, hotel, food, activities, localTransport } = body;

  // 1. Validate budgetINR
  if (
    budgetINR === undefined ||
    budgetINR === null ||
    typeof budgetINR !== "number" ||
    isNaN(budgetINR) ||
    budgetINR <= 0
  ) {
    return res.status(400).json({
      error: true,
      message: "budgetINR is required and must be a number greater than 0",
    });
  }

  // 2. Validate travellers
  if (
    travellers === undefined ||
    travellers === null ||
    typeof travellers !== "number" ||
    isNaN(travellers) ||
    travellers <= 0
  ) {
    return res.status(400).json({
      error: true,
      message: "travellers is required and must be a number greater than 0",
    });
  }

  // 3. Validate days
  if (days === undefined || days === null || typeof days !== "number" || isNaN(days) || days <= 0) {
    return res.status(400).json({
      error: true,
      message: "days is required and must be a number greater than 0",
    });
  }

  // 4. Validate transport costs if provided
  if (transport !== undefined && transport !== null) {
    if (typeof transport !== "object") {
      return res.status(400).json({
        error: true,
        message: "transport must be an object if provided",
      });
    }
    if (transport.totalCost !== undefined && transport.totalCost !== null) {
      if (typeof transport.totalCost !== "number" || isNaN(transport.totalCost) || transport.totalCost < 0) {
        return res.status(400).json({
          error: true,
          message: "transport totalCost cannot be negative and must be a valid number",
        });
      }
    }
  }

  // 5. Validate hotel costs if provided
  if (hotel !== undefined && hotel !== null) {
    if (typeof hotel !== "object") {
      return res.status(400).json({
        error: true,
        message: "hotel must be an object if provided",
      });
    }
    if (hotel.pricePerNight !== undefined && hotel.pricePerNight !== null) {
      if (typeof hotel.pricePerNight !== "number" || isNaN(hotel.pricePerNight) || hotel.pricePerNight < 0) {
        return res.status(400).json({
          error: true,
          message: "hotel pricePerNight cannot be negative and must be a valid number",
        });
      }
    }
    if (hotel.nights !== undefined && hotel.nights !== null) {
      if (typeof hotel.nights !== "number" || isNaN(hotel.nights) || hotel.nights < 0) {
        return res.status(400).json({
          error: true,
          message: "hotel nights cannot be negative and must be a valid number",
        });
      }
    }
    if (hotel.rooms !== undefined && hotel.rooms !== null) {
      if (typeof hotel.rooms !== "number" || isNaN(hotel.rooms) || hotel.rooms < 0) {
        return res.status(400).json({
          error: true,
          message: "hotel rooms cannot be negative and must be a valid number",
        });
      }
    }
  }

  // 6. Validate food costs if provided
  if (food !== undefined && food !== null) {
    if (typeof food !== "object") {
      return res.status(400).json({
        error: true,
        message: "food must be an object if provided",
      });
    }
    if (food.pricePerPersonPerDay !== undefined && food.pricePerPersonPerDay !== null) {
      if (
        typeof food.pricePerPersonPerDay !== "number" ||
        isNaN(food.pricePerPersonPerDay) ||
        food.pricePerPersonPerDay < 0
      ) {
        return res.status(400).json({
          error: true,
          message: "food pricePerPersonPerDay cannot be negative and must be a valid number",
        });
      }
    }
  }

  // 7. Validate localTransport costs if provided
  if (localTransport !== undefined && localTransport !== null) {
    if (typeof localTransport !== "object") {
      return res.status(400).json({
        error: true,
        message: "localTransport must be an object if provided",
      });
    }
    if (localTransport.estimatedCost !== undefined && localTransport.estimatedCost !== null) {
      if (
        typeof localTransport.estimatedCost !== "number" ||
        isNaN(localTransport.estimatedCost) ||
        localTransport.estimatedCost < 0
      ) {
        return res.status(400).json({
          error: true,
          message: "localTransport estimatedCost cannot be negative and must be a valid number",
        });
      }
    }
  }

  // 8. Validate activities costs if provided
  if (activities !== undefined && activities !== null) {
    if (!Array.isArray(activities)) {
      return res.status(400).json({
        error: true,
        message: "activities must be an array if provided",
      });
    }
    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      if (activity && activity.pricePerPerson !== undefined && activity.pricePerPerson !== null) {
        if (
          typeof activity.pricePerPerson !== "number" ||
          isNaN(activity.pricePerPerson) ||
          activity.pricePerPerson < 0
        ) {
          return res.status(400).json({
            error: true,
            message: `activity at index ${i} has negative or invalid pricePerPerson`,
          });
        }
      }
    }
  }

  next();
}
