const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Lead = require("../models/Lead");
const ClientNetwork = require("../models/ClientNetwork");
const ClientBroker = require("../models/ClientBroker");
const sessionManagementService = require('../services/sessionManagementService');

/**
 * FILLER LEADS PHONE NUMBER REPETITION RULES
 * ==========================================
 * This module implements phone number repetition filtering for filler leads orders:
 *
 * 1. Orders with ≤10 filler leads: No repetition of first four digits after phone prefix
 * 2. Orders with 11-20 filler leads: Max 2 repetitions per phone pattern, max 10 pairs total
 * 3. Orders with 21-40 filler leads: Max 4 repetitions per phone pattern
 * 4. Orders with >40 filler leads: No repetition restrictions
 *
 * The system extracts the first four digits after the country code from phone numbers
 * (e.g., +1234567890 -> "2345") and groups leads by these patterns to apply the rules.
 */

/**
 * Helper function to extract first four digits after prefix from phone number
 * This is used to identify phone number patterns for filler leads repetition rules
 * @param {string} phoneNumber - Phone number in format 1234567890 (without +) or +1234567890
 * @returns {string|null} - First four digits after country code (e.g., "2345")
 */
const getFirstFourDigitsAfterPrefix = (phoneNumber) => {
  console.log(`[DEBUG-PHONE] Input: ${phoneNumber}`);

  if (!phoneNumber) {
    console.log(`[DEBUG-PHONE] No phone number provided`);
    return null;
  }

  // Remove all non-digits
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  console.log(`[DEBUG-PHONE] Cleaned: ${cleanPhone}`);

  if (cleanPhone.length < 5) {
    console.log(`[DEBUG-PHONE] Too short: ${cleanPhone.length} digits`);
    return null;
  }

  // For phone numbers stored without +, we need to handle different formats:
  // - If it starts with country code (e.g., "12345678901" for US +1), skip first 1-3 digits
  // - If it's already without country code, take first 4 digits
  // - Common country codes: 1 (US/Canada), 44 (UK), 49 (Germany), etc.

  let result;

  // Check if it starts with common single-digit country codes (1, 7, etc.)
  if (cleanPhone.length >= 11 && ["1", "7"].includes(cleanPhone[0])) {
    // Skip 1 digit country code, take next 4
    result = cleanPhone.substring(1, 5);
  }
  // Check if it starts with common 2-digit country codes (44, 49, 33, etc.)
  else if (
    cleanPhone.length >= 12 &&
    ["44", "49", "33", "34", "39", "41", "43", "45", "46", "47", "48"].includes(
      cleanPhone.substring(0, 2)
    )
  ) {
    // Skip 2 digit country code, take next 4
    result = cleanPhone.substring(2, 6);
  }
  // Check if it starts with common 3-digit country codes (359, 371, etc.)
  else if (
    cleanPhone.length >= 13 &&
    ["359", "371", "372", "373", "374", "375", "376", "377", "378"].includes(
      cleanPhone.substring(0, 3)
    )
  ) {
    // Skip 3 digit country code, take next 4
    result = cleanPhone.substring(3, 7);
  }
  // Default: assume first 4 digits are what we want (no country code)
  else {
    result = cleanPhone.substring(0, 4);
  }

  console.log(`[DEBUG-PHONE] Result: ${result}`);
  return result;
};

/**
 * Helper function to apply phone number repetition rules for filler leads
 * Implements the following rules based on the number of filler leads requested:
 * - ≤10 leads: All leads must have unique first four digits after prefix
 * - 11-20 leads: Max 2 repetitions per pattern, but no more than 10 pairs total with same first 4 digits
 * - 21-40 leads: Max 4 repetitions per pattern, but no more than 20 pairs total with same first 4 digits
 * - >40 leads: No restrictions
 * @param {Array} fillerLeads - Array of filler lead objects
 * @param {number} requestedCount - Number of filler leads requested
 * @returns {Array} - Filtered array of leads following repetition rules
 */
const applyFillerPhoneRepetitionRules = (fillerLeads, requestedCount) => {
  if (!fillerLeads || fillerLeads.length === 0) {
    console.log(`[FILLER-DEBUG] No leads provided`);
    return fillerLeads;
  }

  console.log(`[FILLER-DEBUG] ===== STARTING FILLER PROCESSING =====`);
  console.log(
    `[FILLER-DEBUG] Input: ${fillerLeads.length} filler leads available, ${requestedCount} requested`
  );

  // Group leads by first four digits of phone number
  const phoneGroups = {};
  const leadsWithoutValidPhone = [];

  fillerLeads.forEach((lead, index) => {
    const firstFour = getFirstFourDigitsAfterPrefix(lead.newPhone);
    console.log(
      `[FILLER-DEBUG] Lead ${index}: Phone=${lead.newPhone}, FirstFour=${firstFour}, ID=${lead._id}`
    );

    if (firstFour) {
      if (!phoneGroups[firstFour]) {
        phoneGroups[firstFour] = [];
      }
      phoneGroups[firstFour].push(lead);
    } else {
      console.log(
        `[FILLER-DEBUG] Lead ${index} has no valid phone pattern, adding to backup`
      );
      leadsWithoutValidPhone.push(lead);
    }
  });

  const uniquePatterns = Object.keys(phoneGroups);
  console.log(
    `[FILLER-DEBUG] Phone groups created:`,
    uniquePatterns.map((key) => `${key}:${phoneGroups[key].length}`).join(", ")
  );
  console.log(
    `[FILLER-DEBUG] Leads without valid phone: ${leadsWithoutValidPhone.length}`
  );

  const selectedLeads = [];

  // Apply the repetition rules based on requested count
  if (requestedCount <= 10) {
    // Rule 1: All leads must have unique first four digits
    console.log(`[FILLER-DEBUG] ===== RULE 1 (≤10 leads) =====`);
    console.log(
      `[FILLER-DEBUG] Need ${requestedCount} leads with unique patterns, have ${uniquePatterns.length} unique patterns`
    );

    // Check if we have enough unique patterns
    if (uniquePatterns.length < requestedCount) {
      console.log(
        `[FILLER-DEBUG] ERROR: Not enough unique patterns! Have ${uniquePatterns.length}, need ${requestedCount}`
      );
      console.log(
        `[FILLER-DEBUG] Will return as many unique patterns as possible + leads without valid phone if needed`
      );

      // Take one from each unique pattern
      uniquePatterns.forEach((pattern, index) => {
        if (selectedLeads.length < requestedCount) {
          selectedLeads.push(phoneGroups[pattern][0]);
          console.log(
            `[FILLER-DEBUG] Selected lead ${selectedLeads.length} with pattern ${pattern}`
          );
        }
      });

      // If still need more, add leads without valid phone patterns
      let leadsWithoutPhoneIndex = 0;
      while (
        selectedLeads.length < requestedCount &&
        leadsWithoutPhoneIndex < leadsWithoutValidPhone.length
      ) {
        selectedLeads.push(leadsWithoutValidPhone[leadsWithoutPhoneIndex]);
        console.log(
          `[FILLER-DEBUG] Added lead without valid phone pattern: ${leadsWithoutPhoneIndex + 1
          }`
        );
        leadsWithoutPhoneIndex++;
      }
    } else {
      // We have enough unique patterns - take exactly requestedCount with unique patterns
      for (let i = 0; i < requestedCount; i++) {
        selectedLeads.push(phoneGroups[uniquePatterns[i]][0]);
        console.log(
          `[FILLER-DEBUG] Selected lead ${i + 1} with pattern ${uniquePatterns[i]
          }`
        );
      }
    }
  } else if (requestedCount <= 20) {
    // Rule 2: Max 2 repetitions per pattern, max 10 pairs total
    // This means: each pattern can appear many times, but we count pairs (every 2nd occurrence of same pattern)
    // and limit total pairs to 10, not pairs per pattern
    console.log(`[FILLER-DEBUG] ===== RULE 2 (11-20 leads) =====`);
    console.log(
      `[FILLER-DEBUG] Need ${requestedCount} leads, max 10 pairs total across all patterns`
    );

    const patternCount = {}; // Track how many leads we've taken from each pattern
    let totalPairs = 0;
    const maxPairs = 10;

    // Strategy: Continue adding leads from available patterns until we reach the requested count
    // Count pairs as every 2nd occurrence of the same pattern
    while (selectedLeads.length < requestedCount) {
      let addedThisRound = 0;

      for (const pattern of uniquePatterns) {
        if (selectedLeads.length >= requestedCount) break;

        const currentCount = patternCount[pattern] || 0;
        const availableInGroup = phoneGroups[pattern].length;

        // Can we add another lead from this pattern?
        if (currentCount < availableInGroup) {
          // Check if this would create a new pair (every 2nd lead from same pattern creates a pair)
          const wouldCreatePair = (currentCount + 1) % 2 === 0; // 2nd, 4th, 6th, etc. create pairs

          if (wouldCreatePair && totalPairs >= maxPairs) {
            console.log(
              `[FILLER-DEBUG] Skipping pattern ${pattern} - would exceed total pair limit (${totalPairs}/${maxPairs})`
            );
            continue;
          }

          selectedLeads.push(phoneGroups[pattern][currentCount]);
          patternCount[pattern] = currentCount + 1;
          addedThisRound++;

          if (wouldCreatePair) {
            totalPairs++;
            console.log(
              `[FILLER-DEBUG] Added lead #${currentCount + 1
              } from pattern ${pattern} (creates pair #${totalPairs}), total pairs: ${totalPairs}/${maxPairs} (total leads: ${selectedLeads.length
              })`
            );
          } else {
            console.log(
              `[FILLER-DEBUG] Added lead #${currentCount + 1
              } from pattern ${pattern} (no pair), total leads: ${selectedLeads.length
              }`
            );
          }
        }
      }

      // If we couldn't add any leads this round, we're done
      if (addedThisRound === 0) {
        console.log(
          `[FILLER-DEBUG] No more leads can be added due to constraints or availability, stopping at ${selectedLeads.length} leads`
        );
        break;
      }
    }

    // If still need more leads and have leads without valid phone, add them
    let leadsWithoutPhoneIndex = 0;
    while (
      selectedLeads.length < requestedCount &&
      leadsWithoutPhoneIndex < leadsWithoutValidPhone.length
    ) {
      selectedLeads.push(leadsWithoutValidPhone[leadsWithoutPhoneIndex]);
      console.log(
        `[FILLER-DEBUG] Added lead without valid phone pattern to reach target`
      );
      leadsWithoutPhoneIndex++;
    }
  } else if (requestedCount <= 40) {
    // Rule 3: Max 4 repetitions per pattern, max 20 pairs total
    // This means: each pattern can appear many times, but we count pairs (every 2nd occurrence of same pattern)
    // and limit total pairs to 20, not pairs per pattern
    console.log(`[FILLER-DEBUG] ===== RULE 3 (21-40 leads) =====`);
    console.log(
      `[FILLER-DEBUG] Need ${requestedCount} leads, max 20 pairs total across all patterns`
    );

    const patternCount = {}; // Track how many leads we've taken from each pattern
    let totalPairs = 0;
    const maxPairs = 20;

    // Strategy: Continue adding leads from available patterns until we reach the requested count
    // Count pairs as every 2nd occurrence of the same pattern
    while (selectedLeads.length < requestedCount) {
      let addedThisRound = 0;

      for (const pattern of uniquePatterns) {
        if (selectedLeads.length >= requestedCount) break;

        const currentCount = patternCount[pattern] || 0;
        const availableInGroup = phoneGroups[pattern].length;

        // Can we add another lead from this pattern?
        if (currentCount < availableInGroup) {
          // Check if this would create a new pair (every 2nd lead from same pattern creates a pair)
          const wouldCreatePair = (currentCount + 1) % 2 === 0; // 2nd, 4th, 6th, etc. create pairs

          if (wouldCreatePair && totalPairs >= maxPairs) {
            console.log(
              `[FILLER-DEBUG] Skipping pattern ${pattern} - would exceed total pair limit (${totalPairs}/${maxPairs})`
            );
            continue;
          }

          selectedLeads.push(phoneGroups[pattern][currentCount]);
          patternCount[pattern] = currentCount + 1;
          addedThisRound++;

          if (wouldCreatePair) {
            totalPairs++;
            console.log(
              `[FILLER-DEBUG] Added lead #${currentCount + 1
              } from pattern ${pattern} (creates pair #${totalPairs}), total pairs: ${totalPairs}/${maxPairs} (total leads: ${selectedLeads.length
              })`
            );
          } else {
            console.log(
              `[FILLER-DEBUG] Added lead #${currentCount + 1
              } from pattern ${pattern} (no pair), total leads: ${selectedLeads.length
              }`
            );
          }
        }
      }

      // If we couldn't add any leads this round, we're done
      if (addedThisRound === 0) {
        console.log(
          `[FILLER-DEBUG] No more leads can be added due to constraints or availability, stopping at ${selectedLeads.length} leads`
        );
        break;
      }
    }

    // If still need more leads and have leads without valid phone, add them
    let leadsWithoutPhoneIndex = 0;
    while (
      selectedLeads.length < requestedCount &&
      leadsWithoutPhoneIndex < leadsWithoutValidPhone.length
    ) {
      selectedLeads.push(leadsWithoutValidPhone[leadsWithoutPhoneIndex]);
      console.log(
        `[FILLER-DEBUG] Added lead without valid phone pattern to reach target`
      );
      leadsWithoutPhoneIndex++;
    }
  } else {
    // Rule 4: No restrictions for orders > 40
    console.log(`[FILLER-DEBUG] ===== RULE 4 (>40 leads) =====`);
    console.log(
      `[FILLER-DEBUG] No restrictions, returning up to ${requestedCount} leads`
    );
    return fillerLeads.slice(0, requestedCount);
  }

  console.log(`[FILLER-DEBUG] ===== FINAL RESULT =====`);
  console.log(
    `[FILLER-DEBUG] Selected ${selectedLeads.length} leads out of ${requestedCount} requested`
  );

  // Log pattern distribution in final result
  const finalPatternCount = {};
  selectedLeads.forEach((lead) => {
    const pattern = getFirstFourDigitsAfterPrefix(lead.newPhone);
    finalPatternCount[pattern] = (finalPatternCount[pattern] || 0) + 1;
  });

  console.log(
    `[FILLER-DEBUG] Final pattern distribution:`,
    Object.entries(finalPatternCount)
      .map(([pattern, count]) => `${pattern || "NO_PATTERN"}:${count}`)
      .join(", ")
  );

  if (selectedLeads.length < requestedCount) {
    console.log(
      `[FILLER-DEBUG] WARNING: Could not fulfill complete request. Got ${selectedLeads.length}/${requestedCount} leads`
    );
  }

  return selectedLeads;
};

// Helper function to determine max repetitions based on filler count
const getMaxRepetitionsForFillerCount = (count) => {
  if (count <= 10) return 1;
  if (count <= 20) return 2;
  if (count <= 40) return 4;
  return Infinity; // No limit for larger orders
};

// @desc    Create a new order and pull leads
// @route   POST /api/orders
// @access  Private (Admin, Manager with canCreateOrders permission)
exports.createOrder = async (req, res, next) => {
  try {
    console.log(
      "[CREATE-ORDER-DEBUG] Received request body:",
      JSON.stringify(req.body, null, 2)
    );

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("[CREATE-ORDER-DEBUG] Validation errors:", errors.array());
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const {
      requests,
      priority,
      notes,
      country,
      gender,
      injectionSettings = {
        enabled: true,
        mode: "bulk",
        includeTypes: { filler: true, cold: true, live: true },
      },
      selectedClientNetwork,
    } = req.body;

    const { ftd = 0, filler = 0, cold = 0, live = 0 } = requests || {};

    if (ftd + filler + cold + live === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one lead type must be requested",
      });
    }

    // Validate client network access for affiliate managers (for reference selection only)
    if (req.user.role === "affiliate_manager" && selectedClientNetwork) {
      const clientNetwork = await ClientNetwork.findOne({
        _id: selectedClientNetwork,
        assignedAffiliateManagers: req.user._id,
        isActive: true,
      });

      if (!clientNetwork) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied - client network not assigned to you or inactive",
        });
      }
    }

    const pulledLeads = [];
    const fulfilled = { ftd: 0, filler: 0, cold: 0, live: 0 };

    // Base query filters for country and gender if specified
    const countryFilter = country ? { country: new RegExp(country, "i") } : {};
    const genderFilter = gender ? { gender } : {};

    // Helper function to get available leads with client network checking
    const getAvailableLeadsWithNetworkCheck = async (
      leadType,
      requestedCount
    ) => {
      let query = {
        leadType,
        isAssigned: false,
        brokerAvailabilityStatus: { $ne: "sleep" }, // Exclude sleeping leads
        ...countryFilter,
        ...genderFilter,
      };

      // For FTD leads, ensure they have required documents
      if (leadType === "ftd") {
        query["documents.0"] = { $exists: true };
      }

      let availableLeads = await Lead.find(query).limit(requestedCount * 2); // Get more than needed for filtering

      // If client network is specified, filter out leads already assigned to this network
      if (selectedClientNetwork) {
        availableLeads = availableLeads.filter(
          (lead) => !lead.isAssignedToClientNetwork(selectedClientNetwork)
        );
      }

      return availableLeads.slice(0, requestedCount);
    };

    // Pull FTD leads
    if (ftd > 0) {
      const ftdLeads = await getAvailableLeadsWithNetworkCheck("ftd", ftd);

      if (ftdLeads.length > 0) {
        pulledLeads.push(...ftdLeads);
        fulfilled.ftd = ftdLeads.length;
      }
    }

    // Pull Filler leads with phone number repetition rules
    if (filler > 0) {
      console.log(`[FILLER-DEBUG] ===== FETCHING FILLER LEADS =====`);
      console.log(`[FILLER-DEBUG] Requested filler leads: ${filler}`);

      // Fetch more leads than requested to have enough variety for filtering
      // The multiplier ensures we have enough variety to apply repetition rules
      // With large databases (5000+ leads), we need much higher multipliers to get pattern diversity
      let fetchMultiplier = 1;
      if (filler <= 10) {
        fetchMultiplier = 50; // Need lots of variety for unique pattern rule - fetch 500 leads for 10 requested
      } else if (filler <= 20) {
        fetchMultiplier = 25; // Need massive variety for 2-max rule - fetch 500 leads for 20 requested
      } else if (filler <= 40) {
        fetchMultiplier = 15; // Need lots of variety for 4-max rule - fetch 600 leads for 40 requested
      } else {
        fetchMultiplier = 5; // Still need variety for larger orders
      }

      const fetchLimit = Math.max(filler, Math.ceil(filler * fetchMultiplier));
      console.log(
        `[FILLER-DEBUG] Fetch multiplier: ${fetchMultiplier}, fetching up to ${fetchLimit} leads`
      );

      // Use aggregation with $sample to get random leads for better pattern diversity
      // This helps ensure we don't just get leads with similar phone patterns
      const fillerLeads = await Lead.aggregate([
        {
          $match: {
            leadType: "filler",
            ...countryFilter,
            ...genderFilter,
          },
        },
        {
          $sample: { size: fetchLimit },
        },
      ]);

      console.log(
        `[FILLER-DEBUG] Found ${fillerLeads.length} filler leads in database`
      );

      if (fillerLeads.length > 0) {
        const appliedFillerLeads = applyFillerPhoneRepetitionRules(
          fillerLeads,
          filler
        );
        pulledLeads.push(...appliedFillerLeads);
        fulfilled.filler = appliedFillerLeads.length;
        console.log(
          `[FILLER-DEBUG] Final result: ${appliedFillerLeads.length} filler leads added to order`
        );
      } else {
        console.log(`[FILLER-DEBUG] No filler leads found matching criteria`);
      }
    }

    // Pull Cold leads
    if (cold > 0) {
      const coldLeads = await getAvailableLeadsWithNetworkCheck("cold", cold);

      if (coldLeads.length > 0) {
        pulledLeads.push(...coldLeads);
        fulfilled.cold = coldLeads.length;
      }
    }

    // Pull Live leads
    if (live > 0) {
      const liveLeads = await getAvailableLeadsWithNetworkCheck("live", live);

      if (liveLeads.length > 0) {
        pulledLeads.push(...liveLeads);
        fulfilled.live = liveLeads.length;
      }
    }

    // Determine order status based on fulfillment
    const totalRequested = ftd + filler + cold + live;
    const totalFulfilled =
      fulfilled.ftd + fulfilled.filler + fulfilled.cold + fulfilled.live;

    let orderStatus;
    if (totalFulfilled === 0) {
      orderStatus = "cancelled";
    } else if (
      totalFulfilled === totalRequested &&
      fulfilled.ftd === ftd &&
      fulfilled.filler === filler &&
      fulfilled.cold === cold &&
      fulfilled.live === live
    ) {
      orderStatus = "fulfilled";
    } else {
      orderStatus = "partial";
    }

    // Calculate injection progress for non-FTD leads if injection is enabled
    let injectionProgress = {
      totalToInject: 0,
      totalInjected: 0,
      successfulInjections: 0,
      failedInjections: 0,
      ftdsPendingManualFill: fulfilled.ftd, // FTDs always require manual filling
    };

    if (injectionSettings.enabled) {
      // Calculate total leads to inject (excluding FTDs)
      const leadTypesToInject = injectionSettings.includeTypes || {};
      if (leadTypesToInject.filler)
        injectionProgress.totalToInject += fulfilled.filler;
      if (leadTypesToInject.cold)
        injectionProgress.totalToInject += fulfilled.cold;
      if (leadTypesToInject.live)
        injectionProgress.totalToInject += fulfilled.live;
    }

    // Initialize FTD handling status
    let ftdHandling = {
      status: fulfilled.ftd > 0 ? "manual_fill_required" : "completed",
    };

    // Create the order first
    const order = new Order({
      requester: req.user._id,
      requests: { ftd, filler, cold, live },
      fulfilled,
      leads: pulledLeads.map((l) => l._id),
      priority: priority || "medium",
      notes,
      status: orderStatus,
      countryFilter: country || null,
      genderFilter: gender || null,
      selectedClientNetwork: selectedClientNetwork || null,

      // Add injection settings - always enabled
      injectionSettings: {
        enabled: true,
        mode: injectionSettings.mode || "bulk",
        scheduledTime: injectionSettings.scheduledTime,
        status: "pending",
        includeTypes: {
          filler: true,
          cold: true,
          live: true,
        },
        deviceConfig: injectionSettings.deviceConfig || {},
      },

      // Add FTD handling and injection progress
      ftdHandling,
      injectionProgress,

      // Set cancellation details if no leads available
      ...(orderStatus === "cancelled" && {
        cancelledAt: new Date(),
        cancellationReason:
          "No leads available matching the requested criteria",
      }),
    });

    await order.save();

    // Set lead assignments and update isAssigned status
    const leadIds = [];
    for (const lead of pulledLeads) {
      lead.isAssigned = true;
      lead.assignedTo = req.user._id;
      lead.orderId = order._id;
      lead.createdBy = req.user._id;

      // Add client network assignment to history if specified
      if (selectedClientNetwork) {
        try {
          lead.addClientNetworkAssignment(
            selectedClientNetwork,
            req.user._id,
            order._id
          );
        } catch (error) {
          console.warn(
            `Could not assign client network to lead ${lead._id}: ${error.message}`
          );
        }
      }

      await lead.save();
      leadIds.push(lead._id);
    }

    // Update order with actual lead IDs
    order.leads = leadIds;
    await order.save();

    // Populate the order for response
    await order.populate([
      { path: "requester", select: "fullName email role" },
      {
        path: "leads",
        select: "leadType firstName lastName country email phone orderId",
      },
    ]);

    res.status(201).json({
      success: true,
      message: (() => {
        let msg = `Order created with ${pulledLeads.length} leads`;
        if (orderStatus === "fulfilled") {
          msg += " - fully fulfilled";
        } else if (orderStatus === "partial") {
          msg += ` - partially fulfilled (${totalFulfilled}/${totalRequested} leads)`;
        } else {
          msg += " - cancelled (no leads available)";
        }
        if (country) msg += ` from ${country}`;
        if (gender) msg += ` with gender: ${gender}`;

        // Add phone number filtering info for filler leads
        if (filler > 0 && fulfilled.filler > 0) {
          const maxReps = getMaxRepetitionsForFillerCount(filler);
          if (maxReps === 1) {
            msg += ` (filler leads: no phone number repetitions)`;
          } else if (maxReps === 2) {
            msg += ` (filler leads: max 2 repetitions per phone pattern, max 10 pairs)`;
          } else if (maxReps === 4) {
            msg += ` (filler leads: max 4 repetitions per phone pattern)`;
          }
        }

        return msg;
      })(),
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get orders (Admin sees all, Manager sees own)
// @route   GET /api/orders
// @access  Private (Admin, Manager)
exports.getOrders = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const {
      page = 1,
      limit = 10,
      status,
      priority,
      startDate,
      endDate,
    } = req.query;

    // Build query
    let query = {};

    // Role-based filtering
    if (req.user.role !== "admin") {
      query.requester = req.user._id;
    }

    // Apply filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get orders with pagination
    const orders = await Order.find(query)
      .populate("requester", "fullName email role")
      .populate({
        path: "leads",
        select: "leadType firstName lastName country email phone orderId",
        populate: [
          {
            path: "assignedTo",
            select: "fullName email",
          },
          {
            path: "comments.author",
            select: "fullName",
          },
        ],
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private (Admin, Manager - own orders only)
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("requester", "fullName email role")
      .populate({
        path: "leads",
        populate: [
          {
            path: "assignedTo",
            select: "fullName email",
          },
          {
            path: "comments.author",
            select: "fullName",
          },
        ],
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check permission (non-admin can only see their own orders)
    if (
      req.user.role !== "admin" &&
      order.requester._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order details
// @route   PUT /api/orders/:id
// @access  Private (Admin, Manager - own orders only)
exports.updateOrder = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check permission
    if (
      req.user.role !== "admin" &&
      order.requester.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this order",
      });
    }

    const { priority, notes } = req.body;

    if (priority) order.priority = priority;
    if (notes !== undefined) order.notes = notes;

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel order
// @route   DELETE /api/orders/:id
// @access  Private (Admin, Manager - own orders only)
exports.cancelOrder = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { reason } = req.body;

    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Check permission
      if (
        req.user.role !== "admin" &&
        order.requester.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to cancel this order",
        });
      }

      if (order.status === "cancelled") {
        return res.status(400).json({
          success: false,
          message: "Order is already cancelled",
        });
      }

      // Unassign leads
      await Lead.updateMany(
        { _id: { $in: order.leads } },
        {
          $set: {
            isAssigned: false,
            assignedTo: null,
            assignedAt: null,
          },
        },
        { session }
      );

      // Update order
      order.status = "cancelled";
      order.cancelledAt = new Date();
      order.cancellationReason = reason;

      await order.save({ session });

      res.status(200).json({
        success: true,
        message: "Order cancelled successfully",
        data: order,
      });
    });
  } catch (error) {
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc    Get order statistics
// @route   GET /api/orders/stats
// @access  Private (Admin, Manager)
exports.getOrderStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Build match stage for aggregation
    let matchStage = {};

    // Role-based filtering
    if (req.user.role !== "admin") {
      matchStage.requester = new mongoose.Types.ObjectId(req.user._id);
    }

    // Date filtering
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const stats = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalRequested: {
            $sum: {
              $add: [
                "$requests.ftd",
                "$requests.filler",
                "$requests.cold",
                "$requests.live",
              ],
            },
          },
          totalFulfilled: {
            $sum: {
              $add: [
                "$fulfilled.ftd",
                "$fulfilled.filler",
                "$fulfilled.cold",
                "$fulfilled.live",
              ],
            },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export leads from order as CSV
// @route   GET /api/orders/:id/export
// @access  Private (Admin, Manager - own orders only)
exports.exportOrderLeads = async (req, res, next) => {
  try {
    const orderId = req.params.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // Get order and check ownership
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user can access this order (Admin or owns the order)
    if (
      req.user.role !== "admin" &&
      order.requester.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Get all leads for this order
    const leads = await Lead.find({ orderId: orderId })
      .populate("assignedTo", "fullName")
      .populate("createdBy", "fullName")
      .sort({ createdAt: -1 });

    if (leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No leads found for this order",
      });
    }

    // Generate CSV content
    const csvHeaders = [
      "Lead Type",
      "First Name",
      "Last Name",
      "Email",
      "Prefix",
      "Phone",
      "Country",
      "Gender",
      "Status",
      "DOB",
      "Address",
      "Old Email",
      "Old Phone",
      "Client",
      "Client Broker",
      "Client Network",
      "Facebook",
      "Twitter",
      "LinkedIn",
      "Instagram",
      "Telegram",
      "WhatsApp",
      "ID front",
      "ID back",
      "Selfie front",
      "Selfie back",
      "Assigned To",
      "Created By",
      "Created At",
      "Assigned At",
    ];

    // Helper function to format dates for Excel compatibility
    const formatDateForExcel = (date) => {
      if (!date) return "";
      const d = new Date(date);
      if (isNaN(d.getTime())) return "";

      // Format as DD/MM/YYYY which is more Excel-friendly
      const day = d.getDate().toString().padStart(2, "0");
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      const year = d.getFullYear();

      return `${day}/${month}/${year}`;
    };

    // Helper function to extract document URL by description
    const getDocumentUrl = (documents, description) => {
      if (!documents || !Array.isArray(documents)) return "";
      const doc = documents.find(
        (d) =>
          d.description &&
          d.description.toLowerCase().includes(description.toLowerCase())
      );
      return doc ? doc.url || "" : "";
    };

    // Convert leads to CSV rows
    const csvRows = leads.map((lead) => [
      lead.leadType || "",
      lead.firstName || "",
      lead.lastName || "",
      lead.newEmail || "",
      lead.prefix || "",
      lead.newPhone || "",
      lead.country || "",
      lead.gender || "",
      lead.status || "",
      formatDateForExcel(lead.dob),
      lead.address || "",
      lead.oldEmail || "",
      lead.oldPhone || "",
      lead.client || "",
      lead.clientBroker || "",
      lead.clientNetwork || "",
      lead.socialMedia?.facebook || "",
      lead.socialMedia?.twitter || "",
      lead.socialMedia?.linkedin || "",
      lead.socialMedia?.instagram || "",
      lead.socialMedia?.telegram || "",
      lead.socialMedia?.whatsapp || "",
      getDocumentUrl(lead.documents, "ID Front"),
      getDocumentUrl(lead.documents, "ID Back"),
      getDocumentUrl(lead.documents, "Selfie with ID Front"),
      getDocumentUrl(lead.documents, "Selfie with ID Back"),
      lead.assignedTo?.fullName || "",
      lead.createdBy?.fullName || "",
      formatDateForExcel(lead.createdAt),
      formatDateForExcel(lead.assignedAt),
    ]);

    // Helper function to escape CSV values
    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) return "";
      const stringValue = String(value);
      // If the value contains comma, double quote, or newline, wrap in quotes and escape quotes
      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Build CSV content
    const csvContent = [
      csvHeaders.map(escapeCsvValue).join(","),
      ...csvRows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    // Set response headers for file download
    const filename = `order_${orderId}_leads_${new Date().toISOString().split("T")[0]
      }.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");

    // Send CSV content
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("Export error:", error);
    next(error);
  }
};

// @desc    Assign client, broker, and network info to all leads in order
// @route   PUT /api/orders/:id/assign-client-info
// @access  DISABLED - This functionality has been removed
//
// This endpoint has been disabled to prevent mass assignment of client info to all leads in an order.
// Use individual lead assignment endpoints instead: PUT /api/leads/:id/assign-client-network
exports.assignClientInfoToOrderLeads = async (req, res, next) => {
  return res.status(410).json({
    success: false,
    message:
      "This functionality has been disabled. Please use individual lead assignment instead.",
    details:
      "Use PUT /api/leads/:id/assign-client-network to assign client networks to individual leads.",
  });
};

// @desc    Start order injection
// @route   POST /api/orders/:id/start-injection
// @access  Private (Admin, Affiliate Manager)
exports.startOrderInjection = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate("leads");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user has permission (only admins and affiliate managers)
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can start injection.",
      });
    }

    // Check if injection is enabled for this order
    if (!order.injectionSettings.enabled) {
      return res.status(400).json({
        success: false,
        message: "Injection is not enabled for this order",
      });
    }

    // Check if injection is in a valid state to start
    if (
      order.injectionSettings.status !== "pending" &&
      order.injectionSettings.status !== "paused"
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot start injection. Current status: ${order.injectionSettings.status}`,
      });
    }

    // Calculate total leads to inject if not already set
    if (order.injectionProgress.totalToInject === 0) {
      const Lead = require("../models/Lead");
      const leadsToInject = await Lead.find({
        _id: { $in: order.leads },
        leadType: {
          $in: getInjectableLeadTypes(order.injectionSettings.includeTypes),
        },
      });
      order.injectionProgress.totalToInject = leadsToInject.length;
    }

    // Update injection status
    order.injectionSettings.status = "in_progress";
    order.injectionProgress.lastInjectionAt = new Date();

    await order.save();

    // Start the actual injection process based on mode
    if (order.injectionSettings.mode === "bulk") {
      // Start bulk injection immediately
      startBulkInjection(order);
    } else if (order.injectionSettings.mode === "scheduled") {
      // Start scheduled injection
      startScheduledInjection(order);
    }

    res.status(200).json({
      success: true,
      message: `Injection started successfully in ${order.injectionSettings.mode} mode`,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Pause order injection
// @route   POST /api/orders/:id/pause-injection
// @access  Private (Admin, Affiliate Manager)
exports.pauseOrderInjection = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.injectionSettings.status !== "in_progress") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot pause injection. Injection is not currently in progress.",
      });
    }

    order.injectionSettings.status = "paused";
    await order.save();

    res.status(200).json({
      success: true,
      message: "Injection paused successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Stop order injection
// @route   POST /api/orders/:id/stop-injection
// @access  Private (Admin, Affiliate Manager)
exports.stopOrderInjection = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.injectionSettings.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Injection is already completed",
      });
    }

    order.injectionSettings.status = "completed";
    order.injectionProgress.completedAt = new Date();
    await order.save();

    res.status(200).json({
      success: true,
      message: "Injection stopped successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Skip FTDs and mark for manual filling
// @route   POST /api/orders/:id/skip-ftds
// @access  Private (Admin, Affiliate Manager)
exports.skipOrderFTDs = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.ftdHandling.status !== "manual_fill_required") {
      return res.status(400).json({
        success: false,
        message: "No FTDs requiring manual filling found",
      });
    }

    order.ftdHandling.status = "skipped";
    order.ftdHandling.skippedAt = new Date();
    order.ftdHandling.notes =
      "FTDs skipped for manual filling later by affiliate manager/admin";

    await order.save();

    res.status(200).json({
      success: true,
      message: "FTDs marked for manual filling later",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign client broker to leads after injection
// @route   POST /api/orders/:id/assign-brokers
// @access  Private (Admin, Affiliate Manager)
exports.assignClientBrokers = async (req, res, next) => {
  try {
    const { brokerAssignments } = req.body; // Array of { leadId, clientBroker, domain }

    if (!brokerAssignments || !Array.isArray(brokerAssignments)) {
      return res.status(400).json({
        success: false,
        message: "Broker assignments array is required",
      });
    }

    const order = await Order.findById(req.params.id).populate("leads");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check permission
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can assign brokers.",
      });
    }

    const Lead = require("../models/Lead");
    let assignedCount = 0;

    for (const assignment of brokerAssignments) {
      const { leadId, clientBroker, domain } = assignment;

      const lead = await Lead.findById(leadId);
      if (lead) {
        // Update the injection status and assign broker
        lead.updateInjectionStatus(order._id, "successful", domain);
        lead.clientBroker = clientBroker;
        await lead.save();
        assignedCount++;
      }
    }

    // Update order broker assignment status
    order.clientBrokerAssignment.status = "completed";
    order.clientBrokerAssignment.assignedBy = req.user._id;
    order.clientBrokerAssignment.assignedAt = new Date();
    order.injectionProgress.brokersAssigned = assignedCount;
    order.injectionProgress.brokerAssignmentPending = false;

    await order.save();

    res.status(200).json({
      success: true,
      message: `Successfully assigned brokers to ${assignedCount} leads`,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get leads pending broker assignment for an order
// @route   GET /api/orders/:id/pending-broker-assignment
// @access  Private (Admin, Affiliate Manager)
exports.getLeadsPendingBrokerAssignment = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate({
      path: "leads",
      match: {
        leadType: { $ne: "ftd" }, // Exclude FTDs as they are manual
        "clientNetworkHistory.orderId": req.params.id,
        "clientNetworkHistory.injectionStatus": "pending",
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get available client brokers for each lead
    const leadsWithBrokers = [];

    for (const lead of order.leads) {
      const availableBrokers = await getAvailableClientBrokers(
        lead,
        order.selectedClientNetwork
      );
      leadsWithBrokers.push({
        lead: lead,
        availableBrokers: availableBrokers,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        order: order,
        leadsWithBrokers: leadsWithBrokers,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Skip broker assignment for an order
// @route   POST /api/orders/:id/skip-broker-assignment
// @access  Private (Admin, Affiliate Manager)
exports.skipBrokerAssignment = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    order.clientBrokerAssignment.status = "skipped";
    order.clientBrokerAssignment.assignedBy = req.user._id;
    order.clientBrokerAssignment.assignedAt = new Date();
    order.clientBrokerAssignment.notes = "Broker assignment skipped by user";
    order.injectionProgress.brokerAssignmentPending = false;

    await order.save();

    res.status(200).json({
      success: true,
      message: "Broker assignment skipped successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get FTD leads for manual injection
// @route   GET /api/orders/:id/ftd-leads
// @access  Private (Admin, Affiliate Manager)
exports.getFTDLeadsForOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate("leads");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user has permission (only admins and affiliate managers)
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can access FTD leads.",
      });
    }

    // Filter for FTD leads first, then check injection status
    const ftdLeads = (order.leads || [])
      .filter((lead) => lead && lead.leadType === "ftd")
      .filter((lead) => {
        // Check if lead has been injected for this order
        const networkHistory = lead.clientNetworkHistory?.find(
          (history) => history.orderId?.toString() === order._id.toString()
        );
        // Include leads that:
        // 1. Have no network history for this order (never injected)
        // 2. Have network history but injection status is 'pending'
        // Exclude leads that have been successfully injected (status: 'completed')
        return (
          !networkHistory || networkHistory.injectionStatus !== "completed"
        );
      });

    res.status(200).json({
      success: true,
      data: ftdLeads,
      message: `Found ${ftdLeads.length} FTD lead(s) requiring manual injection`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manual FTD injection
// @route   POST /api/orders/:id/manual-ftd-injection
// @access  Private (Admin, Affiliate Manager)
exports.manualFTDInjection = async (req, res, next) => {
  try {
    const { leadIds, clientBroker, domain, notes } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Lead IDs are required",
      });
    }

    if (!clientBroker || !domain) {
      return res.status(400).json({
        success: false,
        message: "Client broker and domain are required",
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user has permission (only admins and affiliate managers)
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can perform manual FTD injection.",
      });
    }

    // Verify client broker exists
    const ClientBroker = require("../models/ClientBroker");
    const broker = await ClientBroker.findById(clientBroker);
    if (!broker) {
      return res.status(400).json({
        success: false,
        message: "Invalid client broker",
      });
    }

    // Process each FTD lead
    const Lead = require("../models/Lead");
    const processedLeads = [];
    const failedLeads = [];

    for (const leadId of leadIds) {
      try {
        const lead = await Lead.findById(leadId);
        if (!lead || lead.leadType !== "ftd") {
          failedLeads.push({
            leadId,
            reason: "Lead not found or not FTD type",
          });
          continue;
        }

        // Check if lead belongs to this order
        if (!order.leads.includes(leadId)) {
          failedLeads.push({
            leadId,
            reason: "Lead does not belong to this order",
          });
          continue;
        }

        // Update lead's client network history
        const networkHistoryEntry = {
          clientNetwork: order.selectedClientNetwork,
          clientBroker: clientBroker,
          orderId: order._id,
          assignedAt: new Date(),
          domain: domain,
          injectionStatus: "completed",
          injectionType: "manual_ftd",
          injectionNotes:
            notes || "Manual FTD injection by affiliate manager/admin",
        };

        // Check if entry already exists for this order
        const existingHistoryIndex = lead.clientNetworkHistory?.findIndex(
          (history) => history.orderId?.toString() === order._id.toString()
        );

        if (existingHistoryIndex >= 0) {
          // Update existing entry
          lead.clientNetworkHistory[existingHistoryIndex] = networkHistoryEntry;
        } else {
          // Add new entry
          if (!lead.clientNetworkHistory) {
            lead.clientNetworkHistory = [];
          }
          lead.clientNetworkHistory.push(networkHistoryEntry);
        }

        // Mark lead as assigned
        lead.isAssigned = true;
        lead.lastAssignedAt = new Date();

        await lead.save();
        processedLeads.push(lead);
      } catch (error) {
        console.error(`Error processing lead ${leadId}:`, error);
        failedLeads.push({ leadId, reason: error.message });
      }
    }

    // Update order FTD handling status
    if (processedLeads.length > 0) {
      // Check if all FTD leads in this order have been injected
      const allFTDLeads = await Lead.find({
        _id: { $in: order.leads },
        leadType: "ftd",
      });

      const allFTDsInjected = allFTDLeads.every((lead) => {
        const networkHistory = lead.clientNetworkHistory?.find(
          (history) => history.orderId?.toString() === order._id.toString()
        );
        return networkHistory && networkHistory.injectionStatus === "completed";
      });

      if (allFTDsInjected) {
        order.ftdHandling.status = "completed";
        order.ftdHandling.completedAt = new Date();
        order.ftdHandling.notes = `All FTD leads manually injected. ${notes || ""
          }`.trim();
      }

      // Update injection progress
      order.injectionProgress.ftdsPendingManualFill = Math.max(
        0,
        order.injectionProgress.ftdsPendingManualFill - processedLeads.length
      );

      await order.save();
    }

    const response = {
      success: true,
      message: `Successfully injected ${processedLeads.length} FTD lead(s)`,
      data: {
        processedLeads: processedLeads.length,
        failedLeads: failedLeads.length,
        failures: failedLeads,
        order: order,
      },
    };

    if (failedLeads.length > 0) {
      response.message += `. ${failedLeads.length} lead(s) failed to process.`;
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// Helper functions for injection processing
const startBulkInjection = async (order) => {
  try {
    console.log(`Starting bulk injection for order ${order._id}`);

    // Get leads that should be injected (non-FTD leads based on settings)
    const Lead = require("../models/Lead");
    const leadsToInject = await Lead.find({
      _id: { $in: order.leads },
      leadType: {
        $in: getInjectableLeadTypes(order.injectionSettings.includeTypes),
      },
    });

    console.log(
      `Found ${leadsToInject.length} leads to inject for order ${order._id}`
    );
    console.log(
      `[DEBUG] Injectable lead types: ${JSON.stringify(
        getInjectableLeadTypes(order.injectionSettings.includeTypes)
      )}`
    );
    console.log(`[DEBUG] Order leads: ${JSON.stringify(order.leads)}`);
    console.log(
      `[DEBUG] Leads to inject IDs: ${leadsToInject
        .map((l) => l._id)
        .join(", ")}`
    );

    // Process leads one by one with delays
    for (const lead of leadsToInject) {
      console.log(
        `[DEBUG] Processing lead ${lead._id} (${lead.firstName} ${lead.lastName})`
      );
      await injectSingleLead(lead, order._id);
      // Add delay between injections to avoid overwhelming the system
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // The order status is automatically updated by updateOrderInjectionProgress()
    // called within each injectSingleLead() call, so no need to update it here
  } catch (error) {
    console.error(`Error in bulk injection for order ${order._id}:`, error);
    // Update order status to failed
    await Order.findByIdAndUpdate(order._id, {
      "injectionSettings.status": "failed",
    });
  }
};

const startScheduledInjection = async (order) => {
  try {
    console.log(`Starting scheduled injection for order ${order._id}`);

    // Get leads that should be injected
    const Lead = require("../models/Lead");
    const leadsToInject = await Lead.find({
      _id: { $in: order.leads },
      leadType: {
        $in: getInjectableLeadTypes(order.injectionSettings.includeTypes),
      },
    });

    // Schedule injections at random intervals within the specified time window
    scheduleRandomInjections(leadsToInject, order);
  } catch (error) {
    console.error(
      `Error in scheduled injection for order ${order._id}:`,
      error
    );
    await Order.findByIdAndUpdate(order._id, {
      "injectionSettings.status": "failed",
    });
  }
};

const getInjectableLeadTypes = (includeTypes) => {
  const types = [];
  if (includeTypes.filler) types.push("filler");
  if (includeTypes.cold) types.push("cold");
  if (includeTypes.live) types.push("live");
  // Never include 'ftd' as they are always manual
  return types;
};

const injectSingleLead = async (lead, orderId) => {
  try {
    const { spawn } = require("child_process");
    const path = require("path");
    const Order = require("../models/Order");
    const ClientNetwork = require("../models/ClientNetwork");
    const DeviceAssignmentService = require("../services/deviceAssignmentService");
    const ProxyManagementService = require("../services/proxyManagementService");

    // Get order details with injection settings
    const order = await Order.findById(orderId).populate(
      "selectedClientNetwork"
    );

    console.log(
      `[DEBUG] Order selectedClientNetwork: ${order.selectedClientNetwork ? order.selectedClientNetwork.name : "null"
      }`
    );
    console.log(
      `[DEBUG] Lead clientNetworkHistory: ${JSON.stringify(
        lead.clientNetworkHistory
      )}`
    );

    // Check if lead has already been successfully injected for this order
    const existingAssignment = lead.clientNetworkHistory.find(
      (history) =>
        history.orderId &&
        history.orderId.toString() === orderId.toString() &&
        history.injectionStatus === "successful"
    );

    if (existingAssignment) {
      console.log(
        `Lead ${lead._id} already successfully injected for order ${orderId}`
      );
      await updateOrderInjectionProgress(orderId, 0, 1); // Count as successful since it was already done
      return true;
    }

    // Wake up the lead if it's sleeping
    if (lead.brokerAvailabilityStatus === "sleep") {
      console.log(
        `[DEBUG] Waking up sleeping lead ${lead._id} for auto-broker assignment`
      );
      lead.wakeUp();
      await lead.save();
    }

    // Assign device fingerprint if not already assigned
    if (!lead.fingerprint) {
      try {
        console.log(`[DEBUG] Assigning device fingerprint to lead ${lead._id}`);

        const deviceConfig = order.injectionSettings?.deviceConfig || {};
        let deviceType = "android"; // Default device type

        // Determine device type based on configuration
        if (
          deviceConfig.selectionMode === "bulk" &&
          deviceConfig.bulkDeviceType
        ) {
          deviceType = deviceConfig.bulkDeviceType;
        } else if (
          deviceConfig.selectionMode === "individual" &&
          deviceConfig.individualAssignments
        ) {
          const assignment = deviceConfig.individualAssignments.find(
            (assign) => assign.leadId.toString() === lead._id.toString()
          );
          if (assignment) {
            deviceType = assignment.deviceType;
          }
        } else if (
          deviceConfig.selectionMode === "ratio" &&
          deviceConfig.deviceRatio
        ) {
          // For ratio mode, we'll let the service handle it in batch
          // For now, use random selection
          const availableTypes = Object.keys(deviceConfig.deviceRatio).filter(
            (type) => deviceConfig.deviceRatio[type] > 0
          );
          if (availableTypes.length > 0) {
            deviceType =
              availableTypes[Math.floor(Math.random() * availableTypes.length)];
          }
        } else {
          // Random selection from available types
          const availableTypes = deviceConfig.availableDeviceTypes || [
            "windows",
            "android",
            "ios",
            "mac",
          ];
          deviceType =
            availableTypes[Math.floor(Math.random() * availableTypes.length)];
        }

        // Validate deviceType before assignment
        const validDeviceTypes = ["windows", "android", "ios", "mac"];
        if (!deviceType || !validDeviceTypes.includes(deviceType)) {
          console.log(`[WARN] Invalid deviceType '${deviceType}', using default 'android'`);
          deviceType = "android";
        }

        console.log(`[DEBUG] Using deviceType: ${deviceType} for lead ${lead._id}`);

        const deviceSpecs = order.injectionSettings?.deviceConfig?.deviceSpecs || null;
        await lead.assignFingerprint(deviceType, order.requester, deviceSpecs);
        await lead.save();

        console.log(
          `[DEBUG] Assigned ${deviceType} device to lead ${lead._id}`
        );
      } catch (error) {
        console.error(
          `[ERROR] Failed to assign device fingerprint to lead ${lead._id}:`,
          error
        );
        // Continue with injection using default fingerprint
      }
    }

    // Assign proxy for this lead
    let proxyConfig = null;
    try {
      console.log(
        `[DEBUG] Assigning proxy to lead ${lead._id} for country ${lead.country}`
      );

      const proxyResults = await ProxyManagementService.assignProxiesToLeads(
        [lead],
        order.injectionSettings?.proxyConfig || {},
        order.requester
      );

      if (proxyResults.successful.length > 0) {
        const proxyAssignment = proxyResults.successful[0];
        const Proxy = require("../models/Proxy");
        const proxy = await Proxy.findById(proxyAssignment.proxyId);

        if (proxy) {
          proxyConfig = {
            server: proxy.config.server,
            username: proxy.config.username,
            password: proxy.config.password,
            host: proxy.config.host,
            port: proxy.config.port,
            country: proxy.country,
          };
          console.log(
            `[DEBUG] Assigned proxy ${proxy.proxyId} to lead ${lead._id}`
          );
        }
      } else {
        console.error(`[ERROR] Failed to assign proxy to lead ${lead._id}`);
        return false;
      }
    } catch (error) {
      console.error(
        `[ERROR] Error assigning proxy to lead ${lead._id}:`,
        error
      );
      return false;
    }

    // Get fingerprint configuration for injection
    let fingerprintConfig = null;
    if (lead.fingerprint) {
      try {
        const fingerprint = await lead.getFingerprint();
        if (fingerprint) {
          fingerprintConfig = {
            deviceId: fingerprint.deviceId,
            deviceType: fingerprint.deviceType,
            browser: fingerprint.browser,
            screen: fingerprint.screen,
            navigator: fingerprint.navigator,
            webgl: fingerprint.webgl,
            canvasFingerprint: fingerprint.canvasFingerprint,
            audioFingerprint: fingerprint.audioFingerprint,
            timezone: fingerprint.timezone,
            plugins: fingerprint.plugins,
            mobile: fingerprint.mobile,
            additional: fingerprint.additional,
          };
          console.log(
            `[DEBUG] Using fingerprint ${fingerprint.deviceId} for lead ${lead._id}`
          );
        }
      } catch (error) {
        console.error(
          `[ERROR] Failed to get fingerprint for lead ${lead._id}:`,
          error
        );
      }
    }

    // Prepare injection data with fingerprint and proxy configuration
    const injectionData = {
      // Lead basic data
      leadId: lead._id.toString(),
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.newEmail,
      phone: lead.newPhone,
      country: lead.country,
      country_code: lead.prefix || "1",
      // Fingerprint configuration
      fingerprint: fingerprintConfig,
      // Proxy configuration
      proxy: proxyConfig,
      // Target URL
      targetUrl: "https://ftd-copy.vercel.app/landing",
    };

    const scriptPath = path.resolve(
      path.join(__dirname, "..", "..", "injector_playwright.py")
    );

    console.log(`[DEBUG] Script path: ${scriptPath}`);
    console.log(
      `[DEBUG] Injection data: ${JSON.stringify(
        injectionData,
        null,
        2
      )}`
    );
    console.log(`[DEBUG] Working directory: ${process.cwd()}`);

    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(
        "python",
        [scriptPath, JSON.stringify(injectionData)],
        {
          cwd: path.resolve(path.join(__dirname, "..", "..")), // Set working directory to project root
          env: {
            ...process.env,
            NODE_ENV: process.env.NODE_ENV || 'development',
            RENDER: process.env.RENDER || 'false',
            VERCEL: process.env.VERCEL || '0',
            DOCKER: process.env.DOCKER || 'false'
          }
        }
      );

      let stdoutData = "";
      let stderrData = "";

      pythonProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(`[PYTHON STDOUT] ${output}`);
        stdoutData += output;

        // Check for proxy expiration messages
        if (output.includes("PROXY_EXPIRED:")) {
          console.log(`[WARNING] Proxy expired during injection for lead ${lead._id}`);
          // Mark the proxy assignment as expired
          if (lead.proxyAssignments && lead.proxyAssignments.length > 0) {
            const activeAssignment = lead.proxyAssignments.find(
              assignment => assignment.status === 'active' && assignment.orderId.toString() === orderId.toString()
            );
            if (activeAssignment) {
              activeAssignment.status = 'expired';
              activeAssignment.completedAt = new Date();
            }
          }
        }
      });

      pythonProcess.stderr.on("data", (data) => {
        const output = data.toString();
        console.log(`[PYTHON STDERR] ${output}`);
        stderrData += output;
      });

      pythonProcess.on("close", async (code) => {
        console.log(`[DEBUG] Python process closed with code: ${code}`);
        console.log(`[DEBUG] STDOUT: ${stdoutData}`);
        console.log(`[DEBUG] STDERR: ${stderrData}`);

        // Complete proxy assignment regardless of success/failure
        try {
          const status = code === 0 ? "completed" : "failed";
          lead.completeProxyAssignment(orderId, status);
          await lead.save();
          console.log(
            `[DEBUG] Marked proxy assignment as ${status} for lead ${lead._id}`
          );
        } catch (error) {
          console.error(
            `[ERROR] Failed to complete proxy assignment for lead ${lead._id}:`,
            error
          );
        }

        if (code === 0) {
          console.log(
            `Successfully injected lead ${lead._id} for order ${orderId}`
          );

          // Parse final domain from stdout
          let finalDomain = null;
          const domainMatch = stdoutData.match(/FINAL_DOMAIN:(.+)/);
          if (domainMatch) {
            finalDomain = domainMatch[1].trim();
            console.log(`[DEBUG] Extracted final domain: ${finalDomain}`);
          }

          // Add client network assignment to lead history if available
          if (order.selectedClientNetwork) {
            try {
              lead.addClientNetworkAssignment(
                order.selectedClientNetwork._id,
                order.requester,
                orderId
              );
              await lead.save();
            } catch (error) {
              console.warn(
                `Could not assign client network to lead ${lead._id}: ${error.message}`
              );
            }
          }

          // Automatically assign client broker based on final domain
          if (finalDomain) {
            try {
              await assignClientBrokerByDomain(
                lead,
                finalDomain,
                order.requester,
                orderId
              );
              console.log(
                `[DEBUG] Successfully assigned client broker for domain: ${finalDomain}`
              );

              // Update injection status in client broker history
              lead.updateInjectionStatus(orderId, "successful", finalDomain);
              await lead.save();

              // Update broker assignment count
              await Order.findByIdAndUpdate(orderId, {
                $inc: { "injectionProgress.brokersAssigned": 1 },
              });
            } catch (error) {
              console.error(
                `[ERROR] Failed to assign client broker for domain ${finalDomain}:`,
                error
              );
              // Mark injection as failed in client broker history
              lead.updateInjectionStatus(orderId, "failed");
              await lead.save();

              // Mark order as needing manual broker assignment if auto-assignment fails
              await Order.findByIdAndUpdate(orderId, {
                "injectionProgress.brokerAssignmentPending": true,
              });
            }
          } else {
            console.warn(
              `[WARN] No final domain found in output, marking for manual broker assignment`
            );
            // Mark injection as failed in client broker history
            lead.updateInjectionStatus(orderId, "failed");
            await lead.save();

            // Mark order as needing broker assignment
            await Order.findByIdAndUpdate(orderId, {
              "injectionProgress.brokerAssignmentPending": true,
            });
          }

          await updateOrderInjectionProgress(orderId, 0, 1); // Add 1 successful injection
          resolve(true);
        } else {
          console.error(
            `Failed to inject lead ${lead._id} for order ${orderId}:`,
            stderrData
          );

          // Mark injection as failed in client broker history
          try {
            lead.updateInjectionStatus(orderId, "failed");
            await lead.save();
          } catch (error) {
            console.error(
              `[ERROR] Failed to update injection status for lead ${lead._id}:`,
              error
            );
          }

          await updateOrderInjectionProgress(orderId, 1, 0); // Add 1 failed injection
          resolve(false);
        }
      });

      pythonProcess.on("error", (error) => {
        console.error(`Python process error for lead ${lead._id}:`, error);
        reject(error);
      });
    });
  } catch (error) {
    console.error(`Error injecting lead ${lead._id}:`, error);
    return false;
  }
};

// Helper function to get available client brokers for a lead
const getAvailableClientBrokers = async (lead, clientNetwork) => {
  try {
    const ClientBroker = require("../models/ClientBroker");
    console.log(
      `[DEBUG] getAvailableClientBrokers called with clientNetwork: ${clientNetwork ? clientNetwork.name : "null"
      }`
    );

    // Get all active client brokers (since they are now separate entities)
    const allBrokers = await ClientBroker.find({ isActive: true });
    console.log(`[DEBUG] Found ${allBrokers.length} active client brokers`);

    // Filter out brokers this lead has already been assigned to
    const assignedBrokerIds = lead.getAssignedClientBrokers();
    console.log(
      `[DEBUG] Lead already assigned to broker IDs: ${JSON.stringify(
        assignedBrokerIds
      )}`
    );

    // Filter out brokers that the lead is already assigned to
    const availableBrokers = allBrokers.filter(
      (broker) => !assignedBrokerIds.includes(broker._id.toString())
    );

    const availableBrokerDomains = availableBrokers.map(
      (broker) => broker.domain || broker.name
    );
    console.log(
      `[DEBUG] Available brokers after filtering: ${availableBrokerDomains.length}`
    );
    return availableBrokerDomains;
  } catch (error) {
    console.error("Error getting available client brokers:", error);
    return [];
  }
};

// Helper function to assign client broker by domain
const assignClientBrokerByDomain = async (
  lead,
  domain,
  assignedBy,
  orderId
) => {
  try {
    const ClientBroker = require("../models/ClientBroker");

    // First, try to find an existing client broker with this domain
    let clientBroker = await ClientBroker.findOne({
      domain: domain,
      isActive: true,
    });

    // If no broker exists with this domain, create a new one
    if (!clientBroker) {
      console.log(`[DEBUG] Creating new client broker for domain: ${domain}`);

      clientBroker = new ClientBroker({
        name: domain, // Use domain as the name
        domain: domain,
        isActive: true,
        description: `Auto-created from injection redirect to ${domain}`,
        createdBy: assignedBy, // Use the assignedBy parameter as createdBy
        createdAt: new Date(),
      });

      await clientBroker.save();
      console.log(
        `[DEBUG] Created new client broker with ID: ${clientBroker._id}`
      );
    } else {
      console.log(
        `[DEBUG] Found existing client broker for domain: ${domain} (ID: ${clientBroker._id})`
      );
    }

    // Check if lead is already assigned to this broker
    if (lead.isAssignedToClientBroker(clientBroker._id)) {
      console.log(
        `[DEBUG] Lead ${lead._id} is already assigned to broker ${clientBroker._id}`
      );
      return clientBroker; // Return the client broker instead of undefined
    }

    // Assign the client broker to the lead
    lead.assignClientBroker(
      clientBroker._id,
      assignedBy,
      orderId,
      null, // intermediaryClientNetwork - not needed for direct assignment
      domain
    );

    // Update injection status to successful with domain
    // Find the most recent assignment for this order and update it
    const recentAssignment = lead.clientBrokerHistory
      .filter(
        (history) =>
          history.orderId && history.orderId.toString() === orderId.toString()
      )
      .pop(); // Get the most recent one

    if (recentAssignment) {
      recentAssignment.injectionStatus = "successful";
      recentAssignment.domain = domain;
    }

    // Update the client broker's assigned leads
    clientBroker.assignLead(lead._id);

    // Save both documents
    await Promise.all([lead.save(), clientBroker.save()]);

    console.log(
      `[DEBUG] Successfully assigned client broker ${clientBroker.name} (${domain}) to lead ${lead._id}`
    );

    return clientBroker;
  } catch (error) {
    console.error(
      `[ERROR] Failed to assign client broker by domain ${domain}:`,
      error
    );
    throw error;
  }
};

const updateOrderInjectionProgress = async (
  orderId,
  failedCount = 0,
  successCount = 0
) => {
  try {
    const update = {};
    if (failedCount > 0) {
      update["$inc"] = { "injectionProgress.failedInjections": failedCount };
    }
    if (successCount > 0) {
      update["$inc"] = {
        ...update["$inc"],
        "injectionProgress.successfulInjections": successCount,
      };
    }

    await Order.findByIdAndUpdate(orderId, update);

    // Check if injection is complete
    const order = await Order.findById(orderId);
    const totalProcessed =
      order.injectionProgress.successfulInjections +
      order.injectionProgress.failedInjections;

    if (totalProcessed >= order.injectionProgress.totalToInject) {
      await Order.findByIdAndUpdate(orderId, {
        "injectionSettings.status": "completed",
        "injectionProgress.completedAt": new Date(),
      });
      console.log(`Injection completed for order ${orderId}`);

      // Check if all successful injections have been assigned brokers
      const brokersAssigned = order.injectionProgress.brokersAssigned || 0;
      const successfulInjections =
        order.injectionProgress.successfulInjections || 0;

      if (
        brokersAssigned >= successfulInjections &&
        !order.injectionProgress.brokerAssignmentPending
      ) {
        // All brokers have been automatically assigned
        await Order.findByIdAndUpdate(orderId, {
          "clientBrokerAssignment.status": "completed",
          "clientBrokerAssignment.assignedAt": new Date(),
          "clientBrokerAssignment.notes":
            "Auto-assigned based on injection redirect domains",
        });
        console.log(
          `Client broker assignment completed automatically for order ${orderId}`
        );
      }
    }
  } catch (error) {
    console.error(
      `Error updating injection progress for order ${orderId}:`,
      error
    );
  }
};

const scheduleRandomInjections = (leads, order) => {
  // Parse start and end times - handle both ISO8601 and HH:MM formats
  let startTimeMs, endTimeMs;

  if (
    order.injectionSettings.scheduledTime.startTime.includes(":") &&
    order.injectionSettings.scheduledTime.startTime.length <= 5
  ) {
    // HH:MM format
    const [startHour, startMinute] =
      order.injectionSettings.scheduledTime.startTime.split(":").map(Number);
    const [endHour, endMinute] = order.injectionSettings.scheduledTime.endTime
      .split(":")
      .map(Number);

    startTimeMs = (startHour * 60 + startMinute) * 60 * 1000;
    endTimeMs = (endHour * 60 + endMinute) * 60 * 1000;
  } else {
    // ISO8601 format
    const startTime = new Date(order.injectionSettings.scheduledTime.startTime);
    const endTime = new Date(order.injectionSettings.scheduledTime.endTime);
    const now = new Date();

    // Calculate milliseconds from now to start/end times
    startTimeMs = Math.max(0, startTime.getTime() - now.getTime());
    endTimeMs = Math.max(0, endTime.getTime() - now.getTime());
  }

  const windowMs = endTimeMs - startTimeMs;

  if (windowMs <= 0) {
    console.error("Invalid time window for scheduled injection");
    return;
  }

  leads.forEach((lead, index) => {
    // Generate random delay within the time window
    const randomDelay = Math.random() * windowMs;
    const totalDelay = startTimeMs + randomDelay;

    setTimeout(async () => {
      // Check if injection is still active before proceeding
      const currentOrder = await Order.findById(order._id);
      if (currentOrder.injectionSettings.status === "in_progress") {
        await injectSingleLead(lead, order._id);
      }
    }, totalDelay);
  });
};

// @desc    Start manual FTD injection (opens browser for manual filling)
// @route   POST /api/orders/:id/manual-ftd-injection-start
// @access  Private (Admin, Affiliate Manager)
exports.startManualFTDInjection = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user has permission
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins and affiliate managers can perform manual FTD injection.",
      });
    }

    // Get FTD leads for this order
    const Lead = require("../models/Lead");
    const ftdLeads = await Lead.find({
      _id: { $in: order.leads },
      leadType: "ftd",
    });

    if (ftdLeads.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No FTD leads found for this order",
      });
    }

    // Use the first FTD lead for manual injection
    const leadToInject = ftdLeads[0];

    // Prepare injection data for the manual script
    const injectionData = {
      leadId: leadToInject._id.toString(),
      firstName: leadToInject.firstName,
      lastName: leadToInject.lastName,
      email: leadToInject.newEmail,
      phone: leadToInject.newPhone || leadToInject.phone,
      country: leadToInject.country,
      country_code: leadToInject.prefix?.replace('+', '') || '1',
      targetUrl: process.env.LANDING_PAGE_URL || "https://ftd-copy.vercel.app/landing",
      proxy: null // No proxy for manual injection to keep it simple
    };

    // Spawn the manual injector script
    const { spawn } = require('child_process');
    const path = require('path');

    const scriptPath = path.join(__dirname, '../../manual_injector_playwright.py');
    const pythonProcess = spawn('python', [scriptPath, JSON.stringify(injectionData)], {
      stdio: 'pipe',
      cwd: path.dirname(scriptPath)
    });

    // Handle script output
    let scriptOutput = '';
    let scriptError = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      scriptOutput += output;
      console.log(`Manual Injector Output: ${output}`);

      // Check for session data in the output
      if (output.includes('SESSION_DATA:')) {
        try {
          const sessionDataLine = output.split('\n').find(line => line.includes('SESSION_DATA:'));
          if (sessionDataLine) {
            const sessionDataStr = sessionDataLine.split('SESSION_DATA:')[1].trim();
            const sessionData = JSON.parse(sessionDataStr);

            console.log('Session data captured from manual injector:', sessionData);

            // Store session data asynchronously
            sessionManagementService.storeSession(
              sessionData.leadId,
              req.params.id,
              sessionData.sessionData
            ).then(result => {
              console.log('Session data stored successfully:', result);
            }).catch(error => {
              console.error('Failed to store session data:', error);
            });
          }
        } catch (error) {
          console.error('Failed to parse session data from manual injector:', error);
        }
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      scriptError += error;
      console.error(`Manual Injector Error: ${error}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`Manual injector script exited with code ${code}`);
      if (code !== 0) {
        console.error(`Manual injection failed with code ${code}`);
        console.error(`Script error: ${scriptError}`);
      }
    });

    // Don't wait for the script to complete - return immediately
    res.status(200).json({
      success: true,
      message: "Manual FTD injection started. Browser should open shortly.",
      data: {
        leadId: leadToInject._id,
        leadInfo: {
          firstName: leadToInject.firstName,
          lastName: leadToInject.lastName,
          email: leadToInject.newEmail,
          phone: leadToInject.newPhone || leadToInject.phone,
          country: leadToInject.country,
        }
      }
    });

  } catch (error) {
    console.error('Error starting manual FTD injection:', error);
    next(error);
  }
};

// @desc    Complete manual FTD injection (submit domain after manual filling)
// @route   POST /api/orders/:id/manual-ftd-injection-complete
// @access  Private (Admin, Affiliate Manager)
exports.completeManualFTDInjection = async (req, res, next) => {
  try {
    const { domain } = req.body;

    if (!domain || !domain.trim()) {
      return res.status(400).json({
        success: false,
        message: "Domain is required",
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user has permission
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins and affiliate managers can complete manual FTD injection.",
      });
    }

    // Get FTD leads for this order that haven't been processed yet
    const Lead = require("../models/Lead");
    const ftdLeads = await Lead.find({
      _id: { $in: order.leads },
      leadType: "ftd",
    });

    if (ftdLeads.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No FTD leads found for this order",
      });
    }

    // Process the first unprocessed FTD lead
    const leadToProcess = ftdLeads.find(lead => {
      const networkHistory = lead.clientNetworkHistory?.find(
        (history) => history.orderId?.toString() === order._id.toString()
      );
      return !networkHistory || networkHistory.injectionStatus !== "completed";
    });

    if (!leadToProcess) {
      return res.status(400).json({
        success: false,
        message: "All FTD leads for this order have already been processed",
      });
    }

    // Clean and validate domain
    let cleanDomain = domain.trim();
    if (cleanDomain.startsWith('http://') || cleanDomain.startsWith('https://')) {
      try {
        const url = new URL(cleanDomain);
        cleanDomain = url.hostname;
      } catch (e) {
        // If URL parsing fails, just remove the protocol manually
        cleanDomain = cleanDomain.replace(/^https?:\/\//, '');
      }
    }

    // Remove any trailing paths, query parameters, etc.
    cleanDomain = cleanDomain.split('/')[0].split('?')[0].split('#')[0];

    if (!cleanDomain) {
      return res.status(400).json({
        success: false,
        message: "Invalid domain format",
      });
    }

    // Assign client broker based on domain
    try {
      console.log(`[DEBUG] Attempting to assign client broker for domain: ${cleanDomain}`);
      console.log(`[DEBUG] Lead to process: ${leadToProcess._id}`);
      console.log(`[DEBUG] User ID: ${req.user.id}`);
      console.log(`[DEBUG] Order ID: ${order._id}`);

      const assignedBroker = await assignClientBrokerByDomain(
        leadToProcess,
        cleanDomain,
        req.user.id,
        order._id
      );

      if (!assignedBroker) {
        throw new Error('assignClientBrokerByDomain returned null or undefined');
      }

      console.log(`[DEBUG] Successfully assigned broker: ${assignedBroker._id} (${assignedBroker.name})`);

      // Update lead's client network history
      const networkHistoryEntry = {
        clientNetwork: order.selectedClientNetwork,
        clientBroker: assignedBroker._id,
        orderId: order._id,
        assignedAt: new Date(),
        assignedBy: req.user.id,
        domain: cleanDomain,
        injectionStatus: "completed",
        injectionType: "manual_ftd",
        injectionNotes: "Manual FTD injection completed by affiliate manager/admin",
      };

      // Check if entry already exists for this order
      const existingHistoryIndex = leadToProcess.clientNetworkHistory?.findIndex(
        (history) => history.orderId?.toString() === order._id.toString()
      );

      if (existingHistoryIndex >= 0) {
        // Update existing entry
        leadToProcess.clientNetworkHistory[existingHistoryIndex] = networkHistoryEntry;
      } else {
        // Add new entry
        if (!leadToProcess.clientNetworkHistory) {
          leadToProcess.clientNetworkHistory = [];
        }
        leadToProcess.clientNetworkHistory.push(networkHistoryEntry);
      }

      // Mark lead as assigned
      leadToProcess.isAssigned = true;
      leadToProcess.lastAssignedAt = new Date();

      await leadToProcess.save();

      // Update order FTD handling status
      const allFTDLeads = await Lead.find({
        _id: { $in: order.leads },
        leadType: "ftd",
      });

      const allFTDsInjected = allFTDLeads.every((lead) => {
        const networkHistory = lead.clientNetworkHistory?.find(
          (history) => history.orderId?.toString() === order._id.toString()
        );
        return networkHistory && networkHistory.injectionStatus === "completed";
      });

      if (allFTDsInjected) {
        order.ftdHandling.status = "completed";
        order.ftdHandling.completedAt = new Date();
        order.ftdHandling.notes = "All FTD leads manually injected and assigned to client brokers";
      }

      // Update injection progress
      order.injectionProgress.ftdsPendingManualFill = Math.max(
        0,
        order.injectionProgress.ftdsPendingManualFill - 1
      );

      await order.save();

      res.status(200).json({
        success: true,
        message: "Manual FTD injection completed successfully",
        data: {
          leadId: leadToProcess._id,
          domain: cleanDomain,
          clientBroker: {
            id: assignedBroker._id,
            name: assignedBroker.name,
            domain: assignedBroker.domain,
          },
          allFTDsCompleted: allFTDsInjected,
        },
      });

    } catch (error) {
      console.error('Error assigning client broker:', error);
      return res.status(500).json({
        success: false,
        message: "Failed to assign client broker based on domain",
        error: error.message,
      });
    }

  } catch (error) {
    console.error('Error completing manual FTD injection:', error);
    next(error);
  }
};

// @desc    Start manual FTD injection for a specific lead
// @route   POST /api/orders/:id/leads/:leadId/manual-ftd-injection-start
// @access  Private (Admin, Affiliate Manager)
exports.startManualFTDInjectionForLead = async (req, res, next) => {
  try {
    const { id: orderId, leadId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user has permission
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins and affiliate managers can perform manual FTD injection.",
      });
    }

    // Get the specific FTD lead
    const Lead = require("../models/Lead");
    const lead = await Lead.findOne({
      _id: leadId,
      _id: { $in: order.leads },
      leadType: "ftd",
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "FTD lead not found in this order",
      });
    }

    // Check if this lead has already been processed
    const existingHistory = lead.clientNetworkHistory?.find(
      (history) => history.orderId?.toString() === orderId.toString()
    );

    if (existingHistory && existingHistory.injectionStatus === "completed") {
      return res.status(400).json({
        success: false,
        message: "This FTD lead has already been processed",
      });
    }

    // Assign device fingerprint if not already assigned
    if (!lead.fingerprint) {
      try {
        console.log(`[DEBUG] Assigning device fingerprint to FTD lead ${lead._id}`);

        const deviceConfig = order.injectionSettings?.deviceConfig || {};
        let deviceType = "android"; // Default device type

        // Determine device type based on configuration
        if (
          deviceConfig.selectionMode === "bulk" &&
          deviceConfig.bulkDeviceType
        ) {
          deviceType = deviceConfig.bulkDeviceType;
        } else if (
          deviceConfig.selectionMode === "individual" &&
          deviceConfig.individualAssignments
        ) {
          const assignment = deviceConfig.individualAssignments.find(
            (assign) => assign.leadId.toString() === lead._id.toString()
          );
          if (assignment) {
            deviceType = assignment.deviceType;
          }
        } else if (
          deviceConfig.selectionMode === "ratio" &&
          deviceConfig.deviceRatio
        ) {
          // For ratio mode, use random selection based on available types
          const availableTypes = Object.keys(deviceConfig.deviceRatio).filter(
            (type) => deviceConfig.deviceRatio[type] > 0
          );
          if (availableTypes.length > 0) {
            deviceType =
              availableTypes[Math.floor(Math.random() * availableTypes.length)];
          }
        } else {
          // Random selection from available types
          const availableTypes = deviceConfig.availableDeviceTypes || [
            "windows",
            "android",
            "ios",
            "mac",
          ];
          deviceType =
            availableTypes[Math.floor(Math.random() * availableTypes.length)];
        }

        // Validate deviceType before assignment
        const validDeviceTypes = ["windows", "android", "ios", "mac"];
        if (!deviceType || !validDeviceTypes.includes(deviceType)) {
          console.log(`[WARN] Invalid deviceType '${deviceType}', using default 'android'`);
          deviceType = "android";
        }

        console.log(`[DEBUG] Using deviceType: ${deviceType} for FTD lead ${lead._id}`);

        const deviceSpecs = order.injectionSettings?.deviceConfig?.deviceSpecs || null;
        await lead.assignFingerprint(deviceType, order.requester, deviceSpecs);
        await lead.save();

        console.log(
          `[DEBUG] Assigned ${deviceType} device to FTD lead ${lead._id}`
        );
      } catch (error) {
        console.error(
          `[ERROR] Failed to assign device fingerprint to FTD lead ${lead._id}:`,
          error
        );
        // Continue with injection using default fingerprint
      }
    }

    // Get fingerprint configuration for injection
    let fingerprintConfig = null;
    if (lead.fingerprint) {
      try {
        const fingerprint = await lead.getFingerprint();
        if (fingerprint) {
          fingerprintConfig = {
            deviceId: fingerprint.deviceId,
            deviceType: fingerprint.deviceType,
            browser: fingerprint.browser,
            screen: fingerprint.screen,
            navigator: fingerprint.navigator,
            webgl: fingerprint.webgl,
            canvasFingerprint: fingerprint.canvasFingerprint,
            audioFingerprint: fingerprint.audioFingerprint,
            timezone: fingerprint.timezone,
            plugins: fingerprint.plugins,
            mobile: fingerprint.mobile,
            additional: fingerprint.additional,
          };
          console.log(
            `[DEBUG] Using fingerprint ${fingerprint.deviceId} for FTD lead ${lead._id}`
          );
        }
      } catch (error) {
        console.error(
          `[ERROR] Failed to get fingerprint for FTD lead ${lead._id}:`,
          error
        );
      }
    }

    // Prepare injection data for the manual script
    const injectionData = {
      leadId: lead._id.toString(),
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.newEmail,
      phone: lead.newPhone || lead.phone,
      country: lead.country,
      country_code: lead.prefix?.replace('+', '') || '1',
      targetUrl: process.env.LANDING_PAGE_URL || "https://ftd-copy.vercel.app/landing",
      fingerprint: fingerprintConfig, // Include fingerprint configuration
      proxy: null // No proxy for manual injection to keep it simple
    };

    // Spawn the manual injector script
    const { spawn } = require('child_process');
    const path = require('path');

    const scriptPath = path.join(__dirname, '../../manual_injector_playwright.py');
    const pythonProcess = spawn('python', [scriptPath, JSON.stringify(injectionData)], {
      stdio: 'pipe',
      cwd: path.dirname(scriptPath),
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
        RENDER: process.env.RENDER || 'false',
        VERCEL: process.env.VERCEL || '0',
        DOCKER: process.env.DOCKER || 'false'
      }
    });

    // Handle script output
    let scriptOutput = '';
    let scriptError = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      scriptOutput += output;
      console.log(`Manual Injector Output: ${output}`);

      // Check for session data in the output
      if (output.includes('SESSION_DATA:')) {
        try {
          const sessionDataLine = output.split('\n').find(line => line.includes('SESSION_DATA:'));
          if (sessionDataLine) {
            const sessionDataStr = sessionDataLine.split('SESSION_DATA:')[1].trim();
            const sessionData = JSON.parse(sessionDataStr);

            console.log('Session data captured from manual injector:', sessionData);

            // Store session data asynchronously
            sessionManagementService.storeSession(
              sessionData.leadId,
              req.params.id,
              sessionData.sessionData
            ).then(result => {
              console.log('Session data stored successfully:', result);
            }).catch(error => {
              console.error('Failed to store session data:', error);
            });
          }
        } catch (error) {
          console.error('Failed to parse session data from manual injector:', error);
        }
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      scriptError += error;
      console.error(`Manual Injector Error: ${error}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`Manual injector script exited with code ${code}`);
      if (code !== 0) {
        console.error(`Manual injection failed with code ${code}`);
        console.error(`Script error: ${scriptError}`);
      }
    });

    // Don't wait for the script to complete - return immediately
    res.status(200).json({
      success: true,
      message: "Manual FTD injection started. Browser should open shortly.",
      data: {
        leadId: lead._id,
        leadInfo: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.newEmail,
          phone: lead.newPhone || lead.phone,
          country: lead.country,
        },
        deviceInfo: {
          deviceType: lead.deviceType,
          fingerprintId: lead.fingerprint
        }
      }
    });

  } catch (error) {
    console.error('Error starting manual FTD injection for lead:', error);
    next(error);
  }
};

// @desc    Complete manual FTD injection for a specific lead
// @route   POST /api/orders/:id/leads/:leadId/manual-ftd-injection-complete
// @access  Private (Admin, Affiliate Manager)
exports.completeManualFTDInjectionForLead = async (req, res, next) => {
  try {
    const { id: orderId, leadId } = req.params;
    const { domain } = req.body;

    if (!domain || !domain.trim()) {
      return res.status(400).json({
        success: false,
        message: "Domain is required and cannot be empty",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user has permission
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins and affiliate managers can complete manual FTD injection.",
      });
    }

    // Get the specific FTD lead
    const Lead = require("../models/Lead");
    const lead = await Lead.findOne({
      _id: leadId,
      _id: { $in: order.leads },
      leadType: "ftd",
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "FTD lead not found in this order",
      });
    }

    // Check if this lead has already been processed
    const existingHistory = lead.clientNetworkHistory?.find(
      (history) => history.orderId?.toString() === orderId.toString()
    );

    if (existingHistory && existingHistory.injectionStatus === "completed") {
      return res.status(400).json({
        success: false,
        message: "This FTD lead has already been processed",
      });
    }

    // Clean and validate domain
    let cleanDomain = domain.trim();
    if (cleanDomain.startsWith('http://') || cleanDomain.startsWith('https://')) {
      try {
        const url = new URL(cleanDomain);
        cleanDomain = url.hostname;
      } catch (e) {
        // If URL parsing fails, just remove the protocol manually
        cleanDomain = cleanDomain.replace(/^https?:\/\//, '');
      }
    }

    // Remove any trailing paths, query parameters, etc.
    cleanDomain = cleanDomain.split('/')[0].split('?')[0].split('#')[0];

    if (!cleanDomain) {
      return res.status(400).json({
        success: false,
        message: "Invalid domain format",
      });
    }

    // Assign client broker based on domain
    try {
      console.log(`[DEBUG] Attempting to assign client broker for lead ${leadId} with domain: ${cleanDomain}`);

      const assignedBroker = await assignClientBrokerByDomain(
        lead,
        cleanDomain,
        req.user.id,
        order._id
      );

      if (!assignedBroker) {
        throw new Error('Failed to assign client broker for domain');
      }

      console.log(`[DEBUG] Successfully assigned broker: ${assignedBroker._id} (${assignedBroker.name})`);

      // Update lead's client network history
      const networkHistoryEntry = {
        clientNetwork: order.selectedClientNetwork,
        clientBroker: assignedBroker._id,
        orderId: order._id,
        assignedAt: new Date(),
        assignedBy: req.user.id,
        domain: cleanDomain,
        injectionStatus: "completed",
        injectionType: "manual_ftd",
        injectionNotes: `Manual FTD injection completed by ${req.user.fullName || req.user.email}`,
      };

      // Check if entry already exists for this order
      const existingHistoryIndex = lead.clientNetworkHistory?.findIndex(
        (history) => history.orderId?.toString() === order._id.toString()
      );

      if (existingHistoryIndex >= 0) {
        // Update existing entry
        lead.clientNetworkHistory[existingHistoryIndex] = networkHistoryEntry;
      } else {
        // Add new entry
        if (!lead.clientNetworkHistory) {
          lead.clientNetworkHistory = [];
        }
        lead.clientNetworkHistory.push(networkHistoryEntry);
      }

      // Mark lead as assigned
      lead.isAssigned = true;
      lead.lastAssignedAt = new Date();

      await lead.save();

      // Check if all FTD leads in this order are now completed
      const Lead = require("../models/Lead");
      const allFTDLeads = await Lead.find({
        _id: { $in: order.leads },
        leadType: "ftd",
      });

      const allFTDsInjected = allFTDLeads.every((ftdLead) => {
        const networkHistory = ftdLead.clientNetworkHistory?.find(
          (history) => history.orderId?.toString() === order._id.toString()
        );
        return networkHistory && networkHistory.injectionStatus === "completed";
      });

      // Update order status if all FTDs are completed
      if (allFTDsInjected) {
        order.ftdHandling.status = "completed";
        order.ftdHandling.completedAt = new Date();
        order.ftdHandling.notes = "All FTD leads manually injected and assigned to client brokers";
      }

      // Update injection progress
      order.injectionProgress.ftdsPendingManualFill = Math.max(
        0,
        order.injectionProgress.ftdsPendingManualFill - 1
      );

      await order.save();

      res.status(200).json({
        success: true,
        message: "Manual FTD injection completed successfully for this lead",
        data: {
          leadId: lead._id,
          domain: cleanDomain,
          clientBroker: {
            id: assignedBroker._id,
            name: assignedBroker.name,
            domain: assignedBroker.domain,
          },
          allFTDsCompleted: allFTDsInjected,
        },
      });

    } catch (error) {
      console.error(`Error assigning client broker for lead ${leadId}:`, error);
      return res.status(500).json({
        success: false,
        message: "Failed to assign client broker based on domain",
        error: error.message,
      });
    }

  } catch (error) {
    console.error(`Error completing manual FTD injection for lead ${leadId}:`, error);
    next(error);
  }
};

// @desc    Store session data after manual FTD injection
// @route   POST /api/orders/:id/store-session-data
// @access  Private (Admin, Affiliate Manager)
exports.storeSessionData = async (req, res, next) => {
  try {
    const { leadId, sessionData } = req.body;

    if (!leadId || !sessionData) {
      return res.status(400).json({
        success: false,
        message: "Lead ID and session data are required",
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user has permission
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins and affiliate managers can store session data.",
      });
    }

    // Verify that the lead belongs to this order
    const Lead = require("../models/Lead");
    const lead = await Lead.findOne({
      _id: leadId,
      _id: { $in: order.leads },
      leadType: "ftd",
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "FTD lead not found in this order",
      });
    }

    // Store session data using the session management service
    const storeResult = await sessionManagementService.storeSession(
      leadId,
      sessionData
    );

    if (storeResult.success) {
      res.status(200).json({
        success: true,
        message: "Session data stored successfully",
        data: {
          leadId,
          sessionId: storeResult.sessionId
        }
      });
    } else {
      throw new Error("Failed to store session data");
    }

  } catch (error) {
    console.error('Error storing session data:', error);
    next(error);
  }
};

// @desc    Assign FTD with session to agent
// @route   POST /api/orders/:id/assign-ftd-session
// @access  Private (Admin, Affiliate Manager)
exports.assignFTDSession = async (req, res, next) => {
  try {
    const { leadId, agentId } = req.body;

    if (!leadId || !agentId) {
      return res.status(400).json({
        success: false,
        message: "Lead ID and Agent ID are required",
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user has permission
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins and affiliate managers can assign FTD sessions.",
      });
    }

    // Verify that the lead belongs to this order and has session data
    const Lead = require("../models/Lead");
    const lead = await Lead.findOne({
      _id: leadId,
      _id: { $in: order.leads },
      leadType: "ftd",
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "FTD lead not found in this order",
      });
    }

    // Check if lead has session data
    const hasSession = await sessionManagementService.hasActiveSession(leadId);
    if (!hasSession) {
      return res.status(400).json({
        success: false,
        message: "No active session found for this FTD lead",
      });
    }

    // Verify agent exists and is active
    const User = require("../models/User");
    const agent = await User.findOne({
      _id: agentId,
      role: "agent",
      isActive: true
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Active agent not found",
      });
    }

    // Assign session to agent
    const assignResult = await sessionManagementService.assignSessionToAgent(leadId, agentId);

    if (assignResult.success) {
      res.status(200).json({
        success: true,
        message: "FTD session assigned to agent successfully",
        data: {
          leadId,
          agentId,
          agentName: `${agent.firstName} ${agent.lastName}`,
          sessionId: assignResult.sessionId
        }
      });
    } else {
      throw new Error("Failed to assign session to agent");
    }

  } catch (error) {
    console.error('Error assigning FTD session:', error);
    next(error);
  }
};

// @desc    Launch browser with session for agent
// @route   POST /api/orders/:id/launch-agent-browser
// @access  Private (Agent)
exports.launchAgentBrowser = async (req, res, next) => {
  try {
    const { leadId } = req.body;

    if (!leadId) {
      return res.status(400).json({
        success: false,
        message: "Lead ID is required",
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify that the lead belongs to this order
    const Lead = require("../models/Lead");
    const lead = await Lead.findOne({
      _id: leadId,
      _id: { $in: order.leads },
      leadType: "ftd",
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "FTD lead not found in this order",
      });
    }

    // Check if lead is assigned to the requesting agent
    if (!lead.assignedTo || lead.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "This FTD lead is not assigned to you",
      });
    }

    // Launch browser with session
    const launchResult = await sessionManagementService.launchAgentBrowser(leadId, req.user.id);

    if (launchResult.success) {
      // Here you would typically spawn a Python script to launch the browser
      // For now, we'll return the browser launch data
      res.status(200).json({
        success: true,
        message: "Browser session ready for agent",
        data: launchResult.browserLaunchData,
        instructions: launchResult.instructions
      });
    } else {
      throw new Error("Failed to launch agent browser");
    }

  } catch (error) {
    console.error('Error launching agent browser:', error);
    next(error);
  }
};
