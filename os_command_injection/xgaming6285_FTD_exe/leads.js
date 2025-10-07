const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const User = require("../models/User");
const csvParser = require("csv-parser");
const { Readable } = require("stream");
const { spawn } = require("child_process");
const express = require("express");
const ClientNetwork = require("../models/ClientNetwork");
const ClientBroker = require("../models/ClientBroker");
const Campaign = require("../models/Campaign");
const sessionSecurity = require("../utils/sessionSecurity");
exports.getLeads = async (req, res, next) => {
  try {
    const {
      leadType,
      isAssigned,
      country,
      gender,
      status,
      documentStatus,
      page = 1,
      limit = 10,
      search,
      includeConverted = "true",
      order = "newest",
      orderId,
      assignedToMe,
    } = req.query;
    const filter = {};
    if (leadType) filter.leadType = leadType;
    if (isAssigned !== undefined && isAssigned !== "")
      filter.isAssigned = isAssigned === "true";
    if (country) filter.country = new RegExp(country, "i");
    if (gender) filter.gender = gender;
    if (orderId) filter.orderId = new mongoose.Types.ObjectId(orderId);
    let sortOrder = { createdAt: -1 };
    switch (order) {
      case "oldest":
        sortOrder = { createdAt: 1 };
        break;
      case "name_asc":
        sortOrder = { firstName: 1, lastName: 1 };
        break;
      case "name_desc":
        sortOrder = { firstName: -1, lastName: -1 };
        break;
      default:
        sortOrder = { createdAt: -1 };
    }
    if (req.user.role === "affiliate_manager") {
      if (assignedToMe === "true") {
        filter.assignedTo = req.user.id;
        filter.isAssigned = true;
      }
    } else if (req.user.role === "lead_manager") {
      filter.createdBy = req.user.id;
    }
    if (status) {
      filter.status = status;
    } else if (includeConverted !== "true") {
      filter.status = { $ne: "converted" };
    }
    if (documentStatus) filter["documents.status"] = documentStatus;
    if (search) {
      if (
        search.length > 3 &&
        !search.includes(":") &&
        !search.includes("?") &&
        !search.includes("*") &&
        !search.includes("(") &&
        !search.includes(")")
      ) {
        filter.$text = { $search: search };
      } else {
        filter.$or = [
          { firstName: new RegExp(search, "i") },
          { lastName: new RegExp(search, "i") },
          { newEmail: new RegExp(search, "i") },
          { newPhone: new RegExp(search, "i") },
          { client: new RegExp(search, "i") },
        ];
      }
    }
    const skip = (page - 1) * limit;
    const limitNum = parseInt(limit);
    const aggregationPipeline = [
      { $match: filter },
      { $sort: sortOrder },
      { $skip: skip },
      { $limit: limitNum },
      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "assignedToUser",
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "orderDetails",
        },
      },
      {
        $addFields: {
          assignedTo: { $arrayElemAt: ["$assignedToUser", 0] },
          order: { $arrayElemAt: ["$orderDetails", 0] },
        },
      },
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          prefix: 1,
          newEmail: 1,
          newPhone: 1,
          oldEmail: 1,
          oldPhone: 1,
          country: 1,
          leadType: 1,
          isAssigned: 1,
          assignedAt: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          gender: 1,
          client: 1,
          assignedClientBrokers: 1,
          documents: 1,
          "assignedTo._id": 1,
          "assignedTo.fullName": 1,
          "assignedTo.fourDigitCode": 1,
          "order._id": 1,
          "order.status": 1,
          "order.priority": 1,
          "order.createdAt": 1,
        },
      },
    ];
    const leads = await Lead.aggregate(aggregationPipeline);
    const total = await Lead.countDocuments(filter);
    res.status(200).json({
      success: true,
      data: leads,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalLeads: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.getAssignedLeads = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, orderId, leadType } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    const filter = {
      assignedTo: new mongoose.Types.ObjectId(req.user.id),
      isAssigned: true,
    };
    if (status) filter.status = status;
    if (orderId) filter.orderId = new mongoose.Types.ObjectId(orderId);
    if (leadType) filter.leadType = leadType;
    const [results, totalCount] = await Promise.all([
      Lead.aggregate([
        { $match: filter },
        { $sort: { assignedAt: -1 } },
        { $skip: skip },
        { $limit: limitNum },
        {
          $lookup: {
            from: "users",
            localField: "assignedTo",
            foreignField: "_id",
            as: "assignedToDetails",
            pipeline: [
              {
                $project: {
                  fullName: 1,
                  fourDigitCode: 1,
                },
              },
            ],
          },
        },
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "orderDetails",
            pipeline: [
              {
                $project: {
                  status: 1,
                  priority: 1,
                  createdAt: 1,
                },
              },
            ],
          },
        },
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            prefix: 1,
            newEmail: 1,
            country: 1,
            leadType: 1,
            isAssigned: 1,
            assignedAt: 1,
            status: 1,
            createdAt: 1,
            "assignedToDetails.fullName": 1,
            "assignedToDetails.fourDigitCode": 1,
            "orderDetails.status": 1,
            "orderDetails.priority": 1,
            "orderDetails.createdAt": 1,
          },
        },
      ]),
      Lead.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      data: results,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalLeads: totalCount,
        hasNextPage: pageNum * limitNum < totalCount,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.getLeadById = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate("assignedTo", "fullName fourDigitCode email")
      .populate("comments.author", "fullName fourDigitCode");
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      if (!lead.isAssigned || lead.assignedTo._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to access this lead",
        });
      }
    }
    res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};
exports.addComment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { text } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      if (!lead.isAssigned || lead.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to comment on this lead",
        });
      }
    }
    const comment = {
      text,
      author: req.user.id,
      createdAt: new Date(),
    };
    lead.comments.push(comment);
    await lead.save();
    await lead.populate("comments.author", "fullName fourDigitCode");
    res.status(200).json({
      success: true,
      message: "Comment added successfully",
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};
exports.updateLeadStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { status, documentStatus } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      if (!lead.isAssigned || lead.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to update this lead",
        });
      }
    }
    if (status) lead.status = status;
    if (documentStatus && lead.documents) {
      lead.documents.status = documentStatus;
    }
    await lead.save();
    await lead.populate("assignedTo", "fullName fourDigitCode");
    res.status(200).json({
      success: true,
      message: "Lead status updated successfully",
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};
exports.getLeadStats = async (req, res, next) => {
  try {
    let matchCondition = {};
    if (req.user.role === "affiliate_manager") {
    }
    const pipeline = [];
    if (Object.keys(matchCondition).length > 0) {
      pipeline.push({ $match: matchCondition });
    }
    pipeline.push({
      $group: {
        _id: {
          leadType: "$leadType",
          isAssigned: "$isAssigned",
        },
        count: { $sum: 1 },
      },
    });
    const stats = await Lead.aggregate(pipeline);
    const formattedStats = {
      ftd: { assigned: 0, available: 0, total: 0 },
      filler: { assigned: 0, available: 0, total: 0 },
      cold: { assigned: 0, available: 0, total: 0 },
      live: { assigned: 0, available: 0, total: 0 },
      overall: { assigned: 0, available: 0, total: 0 },
    };
    stats.forEach((stat) => {
      const { leadType, isAssigned } = stat._id;
      const count = stat.count;
      if (formattedStats[leadType]) {
        if (isAssigned) {
          formattedStats[leadType].assigned = count;
        } else {
          formattedStats[leadType].available = count;
        }
        formattedStats[leadType].total += count;
        if (isAssigned) {
          formattedStats.overall.assigned += count;
        } else {
          formattedStats.overall.available += count;
        }
        formattedStats.overall.total += count;
      }
    });
    const documentStatsPipeline = [
      {
        $match: {
          leadType: "ftd",
          ...matchCondition,
        },
      },
      {
        $group: {
          _id: "$documents.status",
          count: { $sum: 1 },
        },
      },
    ];
    const documentStats = await Lead.aggregate(documentStatsPipeline);
    const formattedDocumentStats = {
      good: 0,
      ok: 0,
      pending: 0,
    };
    documentStats.forEach((stat) => {
      if (formattedDocumentStats.hasOwnProperty(stat._id)) {
        formattedDocumentStats[stat._id] = stat.count;
      }
    });
    res.status(200).json({
      success: true,
      data: {
        leads: formattedStats,
        documents: formattedDocumentStats,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.assignLeads = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { leadIds, agentId } = req.body;
    const agent = await User.findById(agentId);
    if (
      !agent ||
      agent.role !== "agent" ||
      !agent.isActive ||
      agent.status !== "approved"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive/unapproved agent selected.",
      });
    }
    let updateCondition = {
      _id: { $in: leadIds },
    };
    if (req.user.role === "affiliate_manager") {
    } else if (req.user.role === "admin") {
    }
    console.log("Assigning leads with:", {
      updateCondition,
      agentId,
      agentName: agent.fullName,
      agentCode: agent.fourDigitCode,
    });
    const result = await Lead.updateMany(updateCondition, {
      $set: {
        isAssigned: true,
        assignedTo: agentId,
        assignedAt: new Date(),
      },
    });
    console.log("Assignment result:", result);
    const verifyLeads = await Lead.find({ _id: { $in: leadIds } })
      .populate("assignedTo", "fullName fourDigitCode email")
      .limit(3);
    console.log(
      "Verification - First few assigned leads:",
      verifyLeads.map((lead) => ({
        id: lead._id,
        isAssigned: lead.isAssigned,
        assignedTo: lead.assignedTo
          ? {
              id: lead.assignedTo._id,
              fullName: lead.assignedTo.fullName,
              fourDigitCode: lead.assignedTo.fourDigitCode,
            }
          : null,
      }))
    );
    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} leads assigned successfully`,
      data: {
        assignedCount: result.modifiedCount,
        agentName: agent.fullName,
        agentCode: agent.fourDigitCode,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.unassignLeads = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { leadIds } = req.body;
    let updateCondition = {
      _id: { $in: leadIds },
      isAssigned: true,
    };
    if (req.user.role === "affiliate_manager") {
    }
    const result = await Lead.updateMany(updateCondition, {
      $set: {
        isAssigned: false,
      },
      $unset: {
        assignedTo: 1,
        assignedAt: 1,
      },
    });
    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} leads unassigned successfully`,
      data: {
        unassignedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.assignClientBrokerToLead = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const leadId = req.params.id;
    const { clientBrokerId, client, intermediaryClientNetwork, domain } =
      req.body;
    const [lead, clientBroker] = await Promise.all([
      Lead.findById(leadId),
      ClientBroker.findById(clientBrokerId),
    ]);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (!clientBroker) {
      return res.status(404).json({
        success: false,
        message: "Client broker not found",
      });
    }
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can assign client brokers.",
      });
    }
    if (!clientBroker.isActive) {
      return res.status(400).json({
        success: false,
        message: "Cannot assign lead to inactive client broker",
      });
    }
    if (lead.isAssignedToClientBroker(clientBrokerId)) {
      return res.status(400).json({
        success: false,
        message: `Lead "${lead.firstName} ${lead.lastName}" is already assigned to client broker "${clientBroker.name}".`,
        data: {
          leadId: lead._id,
          leadName: `${lead.firstName} ${lead.lastName}`,
          clientBroker: clientBroker.name,
        },
      });
    }
    lead.assignClientBroker(
      clientBrokerId,
      req.user.id,
      lead.orderId,
      intermediaryClientNetwork,
      domain
    );
    if (client !== undefined) {
      lead.client = client;
    }
    clientBroker.assignLead(leadId);
    await Promise.all([lead.save(), clientBroker.save()]);
    const updatedLead = await Lead.findById(leadId)
      .populate("assignedTo", "fullName fourDigitCode email")
      .populate("assignedClientBrokers", "name domain");
    res.status(200).json({
      success: true,
      message: `Successfully assigned client broker "${clientBroker.name}" to lead "${lead.firstName} ${lead.lastName}"`,
      data: updatedLead,
    });
  } catch (error) {
    console.error("Assign client broker to lead error:", error);
    next(error);
  }
};
exports.getLeadAssignmentHistory = async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const lead = await Lead.findById(leadId)
      .populate(
        "clientBrokerHistory.assignedBy",
        "fullName fourDigitCode email"
      )
      .populate("clientBrokerHistory.orderId", "status createdAt")
      .populate("clientBrokerHistory.clientBroker", "name domain")
      .populate("clientBrokerHistory.intermediaryClientNetwork", "name")
      .populate("assignedClientBrokers", "name domain");
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can view assignment history.",
      });
    }
    res.status(200).json({
      success: true,
      data: {
        leadId: lead._id,
        leadName: `${lead.firstName} ${lead.lastName}`,
        currentAssignments: {
          clientBrokers: lead.assignedClientBrokers.map((broker) => ({
            id: broker._id,
            name: broker.name,
            domain: broker.domain,
          })),
          client: lead.client,
        },
        assignmentHistory: lead.clientBrokerHistory.map((history) => ({
          clientBroker: {
            id: history.clientBroker._id,
            name: history.clientBroker.name,
            domain: history.clientBroker.domain,
          },
          intermediaryClientNetwork: history.intermediaryClientNetwork
            ? {
                id: history.intermediaryClientNetwork._id,
                name: history.intermediaryClientNetwork.name,
              }
            : null,
          assignedAt: history.assignedAt,
          assignedBy: history.assignedBy,
          orderId: history.orderId,
          orderStatus: history.orderId ? history.orderId.status : null,
          orderCreatedAt: history.orderId ? history.orderId.createdAt : null,
          injectionStatus: history.injectionStatus,
          domain: history.domain,
        })),
      },
    });
  } catch (error) {
    console.error("Get lead assignment history error:", error);
    next(error);
  }
};
exports.getClientBrokerAnalytics = async (req, res, next) => {
  try {
    const { orderId } = req.query;
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can view analytics.",
      });
    }
    let matchStage = {};
    if (orderId) {
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order ID format",
        });
      }
      matchStage.orderId = new mongoose.Types.ObjectId(orderId);
    }
    const analytics = await Lead.aggregate([
      { $match: matchStage },
      {
        $unwind: {
          path: "$clientBrokerHistory",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "clientbrokers",
          localField: "clientBrokerHistory.clientBroker",
          foreignField: "_id",
          as: "brokerDetails",
        },
      },
      { $unwind: { path: "$brokerDetails", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            clientBroker: "$clientBrokerHistory.clientBroker",
            orderId: "$clientBrokerHistory.orderId",
          },
          brokerName: { $first: "$brokerDetails.name" },
          brokerDomain: { $first: "$brokerDetails.domain" },
          totalAssignments: { $sum: 1 },
          uniqueLeads: { $addToSet: "$_id" },
          firstAssignment: { $min: "$clientBrokerHistory.assignedAt" },
          lastAssignment: { $max: "$clientBrokerHistory.assignedAt" },
          injectionStatuses: {
            $addToSet: "$clientBrokerHistory.injectionStatus",
          },
        },
      },
      {
        $group: {
          _id: "$_id.clientBroker",
          brokerName: { $first: "$brokerName" },
          brokerDomain: { $first: "$brokerDomain" },
          totalAssignments: { $sum: "$totalAssignments" },
          totalUniqueLeads: { $sum: { $size: "$uniqueLeads" } },
          orderBreakdown: {
            $push: {
              orderId: "$_id.orderId",
              assignments: "$totalAssignments",
              uniqueLeads: { $size: "$uniqueLeads" },
              firstAssignment: "$firstAssignment",
              lastAssignment: "$lastAssignment",
              injectionStatuses: "$injectionStatuses",
            },
          },
        },
      },
      {
        $project: {
          clientBrokerId: "$_id",
          brokerName: 1,
          brokerDomain: 1,
          totalAssignments: 1,
          totalUniqueLeads: 1,
          orderBreakdown: 1,
          _id: 0,
        },
      },
      { $sort: { totalAssignments: -1 } },
    ]);
    res.status(200).json({
      success: true,
      data: {
        analytics,
        totalClientBrokers: analytics.length,
        totalAssignments: analytics.reduce(
          (sum, item) => sum + item.totalAssignments,
          0
        ),
        totalUniqueLeads: analytics.reduce(
          (sum, item) => sum + item.totalUniqueLeads,
          0
        ),
      },
    });
  } catch (error) {
    console.error("Get client broker analytics error:", error);
    next(error);
  }
};
exports.updateLead = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      newEmail,
      oldEmail,
      newPhone,
      oldPhone,
      country,
      status,
      documents,
      leadType,
      socialMedia,
      sin,
      gender,
      address,
    } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (
      req.user.role === "lead_manager" &&
      lead.createdBy &&
      lead.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only edit leads that you created",
      });
    }
    if (firstName) lead.firstName = firstName;
    if (lastName) lead.lastName = lastName;
    if (newEmail) lead.newEmail = newEmail;
    if (oldEmail !== undefined) lead.oldEmail = oldEmail;
    if (newPhone) lead.newPhone = newPhone;
    if (oldPhone !== undefined) lead.oldPhone = oldPhone;
    if (country) lead.country = country;
    if (status) lead.status = status;
    if (leadType) lead.leadType = leadType;
    if (sin !== undefined && leadType === "ftd") lead.sin = sin;
    if (gender !== undefined) lead.gender = gender;
    if (
      address !== undefined &&
      (lead.leadType === "ftd" || lead.leadType === "filler")
    ) {
      lead.address = address;
    }
    if (socialMedia) {
      lead.socialMedia = {
        ...lead.socialMedia,
        ...socialMedia,
      };
    }
    if (documents) {
      lead.documents = documents;
    }
    await lead.save();
    await lead.populate("assignedTo", "fullName fourDigitCode");
    await lead.populate("comments.author", "fullName");
    res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};
exports.createLead = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const {
      firstName,
      lastName,
      newEmail,
      oldEmail,
      newPhone,
      oldPhone,
      country,
      leadType,
      socialMedia,
      sin,
      client,
      clientBroker,
      clientNetwork,
      dob,
      address,
      gender,
      documents,
    } = req.body;
    const existingLead = await Lead.findOne({
      newEmail: newEmail.toLowerCase(),
    });
    if (existingLead) {
      return res.status(400).json({
        success: false,
        message: "A lead with this email already exists",
        errors: [
          {
            type: "field",
            value: newEmail,
            msg: "This email is already registered in the system",
            path: "newEmail",
            location: "body",
          },
        ],
      });
    }
    const leadData = {
      firstName,
      lastName,
      newEmail,
      oldEmail,
      newPhone,
      oldPhone,
      country,
      leadType,
      socialMedia,
      sin,
      client,
      clientBroker,
      clientNetwork,
      dob,
      address,
      gender,
      createdBy: req.user.id,
      isAssigned: false,
      status: "active",
    };
    if (leadType === "ftd") {
      if (documents && Array.isArray(documents) && documents.length > 0) {
        leadData.documents = documents;
      } else {
        leadData.documents = {
          status: "pending",
        };
      }
    } else {
      leadData.documents = documents || [];
    }
    const lead = new Lead(leadData);
    await lead.save();
    res.status(201).json({
      success: true,
      message: "Lead created successfully",
      data: lead,
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.newEmail) {
      return res.status(400).json({
        success: false,
        message: "A lead with this email already exists",
        errors: [
          {
            type: "field",
            value: error.keyValue.newEmail,
            msg: "This email is already registered in the system",
            path: "newEmail",
            location: "body",
          },
        ],
      });
    }
    next(error);
  }
};
const batchProcess = async (items, batchSize, processFn) => {
  const results = [];
  const totalItems = items.length;
  const totalBatches = Math.ceil(totalItems / batchSize);
  console.log(
    `Starting batch processing of ${totalItems} items in ${totalBatches} batches`
  );
  for (let i = 0; i < totalItems; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    console.log(
      `Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`
    );
    const batchResults = await processFn(batch);
    if (Array.isArray(batchResults)) {
      results.push(...batchResults);
    } else {
      results.push(batchResults);
    }
    if (i + batchSize < totalItems) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return results;
};
exports.importLeads = async (req, res, next) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a file",
      });
    }
    const file = req.files.file;
    const fileExtension = file.name.split(".").pop().toLowerCase();
    if (!["csv", "json"].includes(fileExtension)) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV or JSON file",
      });
    }
    let leads = [];
    if (fileExtension === "csv") {
      const results = [];
      const stream = Readable.from(file.data.toString());
      await new Promise((resolve, reject) => {
        stream
          .pipe(csvParser())
          .on("data", (data) => results.push(data))
          .on("error", (error) => reject(error))
          .on("end", () => resolve());
      });
      leads = results;
    } else {
      try {
        leads = JSON.parse(file.data.toString());
        if (!Array.isArray(leads)) {
          leads = [leads];
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid JSON format",
        });
      }
    }
    const parseDate = (dateString) => {
      if (!dateString) return null;
      const parts = dateString.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month, day);
        }
      }
      const parsed = new Date(dateString);
      return isNaN(parsed.getTime()) ? null : parsed;
    };
    const normalizeGender = (gender) => {
      if (!gender) return "not_defined";
      const genderLower = gender.toLowerCase();
      if (genderLower === "male" || genderLower === "m") return "male";
      if (genderLower === "female" || genderLower === "f") return "female";
      return "not_defined";
    };
    const processedLeads = leads.map((lead) => {
      const leadData = {
        firstName:
          lead.firstName ||
          lead.first_name ||
          lead["First name"] ||
          lead["first name"] ||
          "",
        lastName:
          lead.lastName ||
          lead.last_name ||
          lead["Last name"] ||
          lead["last name"] ||
          "",
        newEmail:
          lead.email ||
          lead.newEmail ||
          lead.Email ||
          lead["Email"] ||
          lead["new email"] ||
          "",
        oldEmail: lead.oldEmail || lead["old email"] || "",
        newPhone:
          lead.phone ||
          lead.newPhone ||
          lead["Phone number"] ||
          lead["phone number"] ||
          lead.Phone ||
          lead["new phone"] ||
          "",
        oldPhone: lead.oldPhone || lead["old phone"] || "",
        country: lead.country || lead.Country || lead.GEO || lead.geo || "",
        gender: normalizeGender(lead.gender || lead.Gender || ""),
        prefix: lead.prefix || lead.Prefix || "",
        dob: parseDate(lead.dob || lead.DOB || lead["Date of birth"] || ""),
        address: lead.address || lead.Address || "",
        leadType:
          req.body.leadType || lead.leadType || lead.lead_type || "cold",
        createdBy: req.user.id,
      };
      const socialMedia = {};
      if (lead.Facebook || lead.facebook)
        socialMedia.facebook = lead.Facebook || lead.facebook;
      if (lead.Twitter || lead.twitter)
        socialMedia.twitter = lead.Twitter || lead.twitter;
      if (lead.Linkedin || lead.linkedin)
        socialMedia.linkedin = lead.Linkedin || lead.linkedin;
      if (lead.Instagram || lead.instagram)
        socialMedia.instagram = lead.Instagram || lead.instagram;
      if (lead.Telegram || lead.telegram)
        socialMedia.telegram = lead.Telegram || lead.telegram;
      if (lead.WhatsApp || lead.whatsapp)
        socialMedia.whatsapp = lead.WhatsApp || lead.whatsapp;
      if (Object.keys(socialMedia).length > 0) {
        leadData.socialMedia = socialMedia;
      }
      const documents = [];
      const idFront = lead["ID front"] || lead["id front"] || lead.id_front;
      const idBack = lead["ID back"] || lead["id back"] || lead.id_back;
      const selfieFront =
        lead["Selfie front"] || lead["selfie front"] || lead.selfie_front;
      const selfieBack =
        lead["Selfie back"] || lead["selfie back"] || lead.selfie_back;
      if (idFront && idFront.trim()) {
        documents.push({
          url: idFront.trim(),
          description: "ID Front",
        });
      }
      if (idBack && idBack.trim()) {
        documents.push({
          url: idBack.trim(),
          description: "ID Back",
        });
      }
      if (selfieFront && selfieFront.trim()) {
        documents.push({
          url: selfieFront.trim(),
          description: "Selfie with ID Front",
        });
      }
      if (selfieBack && selfieBack.trim()) {
        documents.push({
          url: selfieBack.trim(),
          description: "Selfie with ID Back",
        });
      }
      if (documents.length > 0) {
        leadData.documents = documents;
      }
      if (leadData.leadType === "ftd") {
        const sinValue =
          lead.sin || lead.SIN || lead["Social Insurance Number"] || "";
        if (sinValue && sinValue.trim().length > 0) {
          leadData.sin = sinValue.trim();
        }
      }
      return leadData;
    });
    const validLeads = processedLeads.filter(
      (lead) =>
        lead.firstName && lead.newEmail && (lead.newPhone || lead.country)
    );
    console.log(`Total leads parsed: ${processedLeads.length}`);
    console.log(`Valid leads after filtering: ${validLeads.length}`);
    if (processedLeads.length > 0) {
      console.log("Sample parsed lead:", processedLeads[0]);
      console.log("Raw lead data sample:", leads[0]);
    }
    if (validLeads.length > 0) {
      console.log("Sample valid lead:", validLeads[0]);
    } else {
      console.log("Invalid leads sample (first 5):");
      processedLeads.slice(0, 5).forEach((lead, index) => {
        console.log(`Lead ${index + 1}:`, {
          firstName: lead.firstName,
          newEmail: lead.newEmail,
          newPhone: lead.newPhone,
          country: lead.country,
          isValid: !!(
            lead.firstName &&
            lead.newEmail &&
            (lead.newPhone || lead.country)
          ),
          validationDetails: {
            hasFirstName: !!lead.firstName,
            hasEmail: !!lead.newEmail,
            hasPhoneOrCountry: !!(lead.newPhone || lead.country),
          },
        });
      });
    }
    if (validLeads.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid leads found in the file",
      });
    }
    const BATCH_SIZE = 100;
    const savedLeads = await batchProcess(
      validLeads,
      BATCH_SIZE,
      async (batch) => {
        const emails = batch.map((lead) => lead.newEmail);
        const existingEmails = await Lead.distinct("newEmail", {
          newEmail: { $in: emails },
        });
        console.log(`Batch processing: ${batch.length} leads in batch`);
        console.log(
          `Found ${existingEmails.length} existing emails:`,
          existingEmails.slice(0, 5)
        );
        const newLeads = batch.filter(
          (lead) => !existingEmails.includes(lead.newEmail)
        );
        console.log(
          `After duplicate filtering: ${newLeads.length} new leads to insert`
        );
        if (newLeads.length === 0) {
          console.log("No new leads to insert - all were duplicates");
          return [];
        }
        console.log(`Inserting ${newLeads.length} new leads...`);
        const result = await Lead.insertMany(newLeads, {
          ordered: false,
          rawResult: true,
        });
        console.log("Insert result:", result);
        if (
          result.mongoose &&
          result.mongoose.validationErrors &&
          result.mongoose.validationErrors.length > 0
        ) {
          console.log("Validation errors found:");
          result.mongoose.validationErrors
            .slice(0, 3)
            .forEach((error, index) => {
              console.log(`Validation error ${index + 1}:`, error.message);
              console.log("Error details:", error);
            });
        }
        return result;
      }
    );
    let importCount = 0;
    savedLeads.forEach((result) => {
      if (result.insertedCount) importCount += result.insertedCount;
    });
    res.status(200).json({
      success: true,
      message: `${importCount} leads imported successfully`,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Some leads could not be imported due to duplicate emails",
      });
    }
    next(error);
  }
};
exports.deleteLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete leads",
      });
    }
    await lead.deleteOne();
    res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
exports.injectLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });
    }
    const landingPage = req.body.landingPage;
    if (!landingPage) {
      return res.status(400).json({
        success: false,
        message: "Landing page URL is required",
      });
    }
    const leadData = {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.newEmail,
      phone: lead.newPhone,
      country: lead.country,
      country_code: lead.prefix || "1",
      landingPage,
      password: "TPvBwkO8",
    };
    console.log("Starting Python script with lead data:", leadData);
    const path = require("path");
    const scriptPath = path.resolve(
      path.join(__dirname, "..", "..", "injector_playwright.py")
    );
    console.log("Python script path:", scriptPath);
    const fs = require("fs");
    if (!fs.existsSync(scriptPath)) {
      console.error("Python script not found at:", scriptPath);
      return res.status(500).json({
        success: false,
        message: "Injection script not found",
        details: `Script not found at ${scriptPath}`,
      });
    }
    try {
      const pythonCheck = spawn("python3", ["--version"]);
      pythonCheck.on("error", (error) => {
        console.error("Python not found:", error);
        return res.status(500).json({
          success: false,
          message: "Python not installed or not in PATH",
          error: error.message,
        });
      });
    } catch (error) {
      console.error("Failed to check Python:", error);
    }
    const pythonProcess = spawn("python3", [
      scriptPath,
      JSON.stringify(leadData),
    ]);
    let stdoutData = "";
    let stderrData = "";
    pythonProcess.stdout.on("data", (data) => {
      const output = data.toString();
      stdoutData += output;
      console.log(`Python Script Output: ${output}`);
    });
    pythonProcess.stderr.on("data", (data) => {
      const error = data.toString();
      stderrData += error;
      console.error(`Python Script Error: ${error}`);
    });
    pythonProcess.on("error", (error) => {
      console.error("Failed to start Python process:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to start injection process",
        error: error.message,
      });
    });
    pythonProcess.on("close", (code) => {
      console.log(`Python process exited with code ${code}`);
      if (code === 0) {
        res.status(200).json({
          success: true,
          message: "Injection process completed successfully.",
          output: stdoutData,
        });
      } else {
        res.status(500).json({
          success: false,
          message: `Injection process failed with exit code ${code}`,
          error: stderrData,
          output: stdoutData,
        });
      }
    });
  } catch (error) {
    console.error("Server error during injection:", error);
    res.status(500).json({
      success: false,
      message: "Server error during injection.",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};
exports.bulkDeleteLeads = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete leads",
      });
    }
    const {
      leadType,
      country,
      gender,
      status,
      documentStatus,
      isAssigned,
      search,
    } = req.body;
    const filter = {};
    if (leadType) filter.leadType = leadType;
    if (country) filter.country = new RegExp(country, "i");
    if (gender) filter.gender = gender;
    if (status) filter.status = status;
    if (documentStatus) filter["documents.status"] = documentStatus;
    if (isAssigned !== undefined && isAssigned !== "") {
      filter.isAssigned = isAssigned === "true" || isAssigned === true;
    }
    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { newEmail: new RegExp(search, "i") },
        { oldEmail: new RegExp(search, "i") },
        { newPhone: new RegExp(search, "i") },
        { oldPhone: new RegExp(search, "i") },
      ];
    }
    const result = await Lead.deleteMany(filter);
    res.status(200).json({
      success: true,
      message: `${result.deletedCount} leads deleted successfully`,
      data: {
        deletedCount: result.deletedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.wakeUpSleepingLeads = async (req, res, next) => {
  try {
    const Lead = require("../models/Lead");
    const ClientNetwork = require("../models/ClientNetwork");
    const sleepingLeads = await Lead.findSleepingLeads();
    let wokeUpCount = 0;
    if (sleepingLeads.length > 0) {
      const clientNetworks = await ClientNetwork.find({ isActive: true });
      for (const lead of sleepingLeads) {
        let hasAvailableBrokers = false;
        for (const network of clientNetworks) {
          if (network.clientBrokers && network.clientBrokers.length > 0) {
            const availableBrokers = network.clientBrokers
              .filter((broker) => broker.isActive)
              .map((broker) => broker.domain || broker.name);
            const assignedBrokers = lead.getAssignedClientBrokers();
            const hasNewBrokers = availableBrokers.some(
              (broker) => !assignedBrokers.includes(broker)
            );
            if (hasNewBrokers) {
              hasAvailableBrokers = true;
              break;
            }
          }
        }
        if (hasAvailableBrokers) {
          lead.wakeUp();
          await lead.save();
          wokeUpCount++;
        }
      }
    }
    res.status(200).json({
      success: true,
      message: `Checked ${sleepingLeads.length} sleeping leads and woke up ${wokeUpCount}`,
      data: {
        totalSleepingLeads: sleepingLeads.length,
        wokeUpCount: wokeUpCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.assignCampaignToLead = async (req, res, next) => {
  try {
    const { campaignId, orderId } = req.body;
    const leadId = req.params.id;
    if (!campaignId) {
      return res.status(400).json({
        success: false,
        message: "Campaign ID is required - campaign assignment is mandatory",
      });
    }
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    const Campaign = require("../models/Campaign");
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }
    if (!campaign.isActive || campaign.status !== "active") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot assign inactive campaign - only active campaigns can be assigned",
      });
    }
    if (req.user.role === "affiliate_manager") {
      const isAssigned = campaign.assignedAffiliateManagers.some(
        (managerId) => managerId.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Access denied - campaign not assigned to you",
        });
      }
    }
    let order = null;
    if (orderId) {
      const Order = require("../models/Order");
      order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }
    }
    const campaignAssignment = {
      campaign: campaignId,
      assignedBy: req.user._id,
      assignedAt: new Date(),
      order: orderId || null,
      performance: {
        status: "assigned",
        assignedAt: new Date(),
      },
    };
    if (!lead.campaignHistory) {
      lead.campaignHistory = [];
    }
    const existingAssignment = lead.campaignHistory.find(
      (history) => history.campaign.toString() === campaignId.toString()
    );
    if (existingAssignment) {
      existingAssignment.assignedBy = req.user._id;
      existingAssignment.assignedAt = new Date();
      if (orderId) {
        existingAssignment.order = orderId;
      }
      existingAssignment.performance.status = "reassigned";
      existingAssignment.performance.assignedAt = new Date();
    } else {
      lead.campaignHistory.push(campaignAssignment);
    }
    await lead.save();
    await campaign.updateMetrics();
    await lead.populate([
      {
        path: "campaignHistory.campaign",
        select: "name status",
      },
      {
        path: "campaignHistory.assignedBy",
        select: "fullName email",
      },
      {
        path: "campaignHistory.order",
        select: "orderNumber status",
      },
    ]);
    res.status(200).json({
      success: true,
      message: "Campaign assigned to lead successfully",
      data: {
        lead: {
          _id: lead._id,
          fullName: `${lead.firstName} ${lead.lastName}`,
          campaignHistory: lead.campaignHistory,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.storeLeadSession = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    const { sessionData, orderId } = req.body;
    const leadId = req.params.id;
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (req.user.role === "affiliate_manager") {
      if (
        lead.assignedTo?.toString() !== req.user._id.toString() &&
        lead.createdBy?.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied - lead not assigned to you",
        });
      }
    }
    if (orderId) {
      const Order = require("../models/Order");
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }
    }
    const integrityValidation =
      sessionSecurity.validateSessionIntegrity(sessionData);
    if (!integrityValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Session data validation failed",
        errors: integrityValidation.errors,
        warnings: integrityValidation.warnings,
      });
    }
    const encryptedSessionData =
      sessionSecurity.encryptSessionData(sessionData);
    const sessionId = lead.storeBrowserSession(
      encryptedSessionData,
      orderId,
      req.user._id
    );
    await lead.save();
    sessionSecurity.logSessionAccess({
      sessionId: sessionData.sessionId,
      leadId: lead._id.toString(),
      userId: req.user._id.toString(),
      userRole: req.user.role,
      action: "store",
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      success: true,
      metadata: {
        orderId: orderId,
        domain: sessionData.metadata?.domain,
        cookieCount: sessionData.cookies?.length || 0,
      },
    });
    res.status(201).json({
      success: true,
      message: "Session data stored and encrypted successfully",
      data: {
        leadId: lead._id,
        sessionId: sessionId,
        currentSessionId: lead.currentSessionId,
        sessionCreatedAt: sessionData.createdAt || new Date(),
        sessionMetadata: sessionData.metadata,
        encryptionStatus: "encrypted",
        integrityHash: sessionSecurity.generateSessionHash(sessionData),
      },
    });
  } catch (error) {
    console.error("Error storing session:", error);
    next(error);
  }
};
exports.getLeadSession = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    const leadId = req.params.id;
    const { sessionId, includeHistory = false } = req.query;
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (req.user.role === "agent") {
      if (lead.assignedTo?.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied - lead not assigned to you",
        });
      }
    } else if (req.user.role === "affiliate_manager") {
      if (
        lead.assignedTo?.toString() !== req.user._id.toString() &&
        lead.createdBy?.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied - lead not assigned to you",
        });
      }
    }
    let encryptedSessionData;
    if (sessionId) {
      encryptedSessionData = lead.getSessionById(sessionId);
    } else {
      encryptedSessionData = lead.getCurrentBrowserSession();
    }
    if (!encryptedSessionData) {
      sessionSecurity.logSessionAccess({
        sessionId: sessionId || "unknown",
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "access",
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent"),
        success: false,
        errorMessage: sessionId
          ? "Session not found"
          : "No active session found",
      });
      return res.status(404).json({
        success: false,
        message: sessionId
          ? "Session not found"
          : "No active session found for this lead",
      });
    }
    let sessionData;
    try {
      sessionData = sessionSecurity.decryptSessionData(encryptedSessionData);
    } catch (decryptionError) {
      console.error("❌ Session decryption failed:", decryptionError);
      sessionSecurity.logSessionAccess({
        sessionId: encryptedSessionData.sessionId || "unknown",
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "access",
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent"),
        success: false,
        errorMessage: "Session decryption failed",
      });
      return res.status(500).json({
        success: false,
        message: "Failed to decrypt session data",
      });
    }
    const integrityValidation =
      sessionSecurity.validateSessionIntegrity(sessionData);
    if (!integrityValidation.isValid) {
      console.warn(
        "⚠️ Session integrity validation failed:",
        integrityValidation.errors
      );
      if (integrityValidation.isTampered) {
        sessionSecurity.logSessionAccess({
          sessionId: sessionData.sessionId,
          leadId: leadId,
          userId: req.user._id.toString(),
          userRole: req.user.role,
          action: "access",
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get("User-Agent"),
          success: false,
          errorMessage: "Session appears to be tampered with",
        });
        return res.status(400).json({
          success: false,
          message: "Session data appears to be tampered with",
        });
      }
    }
    const responseData = {
      leadId,
      currentSession: {
        sessionId: sessionData.sessionId,
        createdAt: sessionData.createdAt,
        lastAccessedAt: sessionData.lastAccessedAt,
        isActive: sessionData.isActive,
        metadata: sessionData.metadata,
        userAgent: sessionData.userAgent,
        viewport: sessionData.viewport,
        cookieCount: sessionData.cookies?.length || 0,
        localStorageItemCount: sessionData.localStorage
          ? Object.keys(sessionData.localStorage).length
          : 0,
        sessionStorageItemCount: sessionData.sessionStorage
          ? Object.keys(sessionData.sessionStorage).length
          : 0,
        integrityHash: sessionSecurity.generateSessionHash(sessionData),
      },
      hasActiveSession: lead.hasActiveBrowserSession(),
      validationResult: {
        isValid: integrityValidation.isValid,
        warnings: integrityValidation.warnings,
        isExpired: integrityValidation.isExpired,
      },
    };
    if (includeHistory === "true" || includeHistory === true) {
      const sessionHistory = lead.sessionHistory || [];
      responseData.sessionHistory = sessionHistory.map((encryptedSession) => {
        try {
          const decryptedSession =
            sessionSecurity.decryptSessionData(encryptedSession);
          return {
            sessionId: decryptedSession.sessionId,
            createdAt: decryptedSession.createdAt,
            lastAccessedAt: decryptedSession.lastAccessedAt,
            isActive: decryptedSession.isActive,
            metadata: decryptedSession.metadata,
            cookieCount: decryptedSession.cookies?.length || 0,
            integrityHash:
              sessionSecurity.generateSessionHash(decryptedSession),
          };
        } catch (error) {
          console.error("❌ Failed to decrypt session history item:", error);
          return {
            sessionId: encryptedSession.sessionId || "unknown",
            error: "Failed to decrypt session data",
          };
        }
      });
    }
    lead.updateSessionAccess(sessionData.sessionId);
    await lead.save();
    sessionSecurity.logSessionAccess({
      sessionId: sessionData.sessionId,
      leadId: leadId,
      userId: req.user._id.toString(),
      userRole: req.user.role,
      action: "access",
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      success: true,
      metadata: {
        domain: sessionData.metadata?.domain,
        cookieCount: sessionData.cookies?.length || 0,
      },
    });
    res.status(200).json({
      success: true,
      message: "Session data retrieved successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Error retrieving session:", error);
    next(error);
  }
};
exports.updateLeadSession = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    const leadId = req.params.id;
    const { sessionId, sessionData, isActive, metadata } = req.body;
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (req.user.role === "affiliate_manager") {
      if (
        lead.assignedTo?.toString() !== req.user._id.toString() &&
        lead.createdBy?.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied - lead not assigned to you",
        });
      }
    }
    let sessionToUpdate = null;
    let isCurrentSession = false;
    if (lead.browserSession && lead.browserSession.sessionId === sessionId) {
      sessionToUpdate = lead.browserSession;
      isCurrentSession = true;
    } else {
      const historySession = lead.sessionHistory?.find(
        (session) => session.sessionId === sessionId
      );
      if (historySession) {
        sessionToUpdate = historySession;
      }
    }
    if (!sessionToUpdate) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }
    if (sessionData) {
      if (sessionData.cookies) sessionToUpdate.cookies = sessionData.cookies;
      if (sessionData.localStorage)
        sessionToUpdate.localStorage = sessionData.localStorage;
      if (sessionData.sessionStorage)
        sessionToUpdate.sessionStorage = sessionData.sessionStorage;
      if (sessionData.userAgent)
        sessionToUpdate.userAgent = sessionData.userAgent;
      if (sessionData.viewport) sessionToUpdate.viewport = sessionData.viewport;
    }
    if (typeof isActive === "boolean") {
      sessionToUpdate.isActive = isActive;
      if (!isActive && isCurrentSession) {
        lead.currentSessionId = null;
      }
      if (isActive && !isCurrentSession) {
        if (lead.browserSession) {
          lead.browserSession.isActive = false;
        }
        lead.browserSession = sessionToUpdate;
        lead.currentSessionId = sessionId;
        lead.sessionHistory =
          lead.sessionHistory?.filter(
            (session) => session.sessionId !== sessionId
          ) || [];
      }
    }
    if (metadata) {
      sessionToUpdate.metadata = { ...sessionToUpdate.metadata, ...metadata };
    }
    sessionToUpdate.lastAccessedAt = new Date();
    await lead.save();
    res.status(200).json({
      success: true,
      message: "Session updated successfully",
      data: {
        leadId,
        sessionId,
        isActive: sessionToUpdate.isActive,
        lastAccessedAt: sessionToUpdate.lastAccessedAt,
        isCurrentSession: lead.currentSessionId === sessionId,
      },
    });
  } catch (error) {
    console.error("Error updating session:", error);
    next(error);
  }
};
exports.clearLeadSession = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    const leadId = req.params.id;
    const { sessionId, clearAll = false } = req.query;
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (req.user.role === "affiliate_manager") {
      if (
        lead.assignedTo?.toString() !== req.user._id.toString() &&
        lead.createdBy?.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied - lead not assigned to you",
        });
      }
    }
    let clearedSessions = 0;
    let message = "";
    if (clearAll === "true" || clearAll === true) {
      if (lead.browserSession) {
        lead.browserSession = undefined;
        clearedSessions++;
      }
      if (lead.sessionHistory && lead.sessionHistory.length > 0) {
        clearedSessions += lead.sessionHistory.length;
        lead.sessionHistory = [];
      }
      lead.currentSessionId = null;
      message = `All ${clearedSessions} sessions cleared successfully`;
    } else if (sessionId) {
      let sessionFound = false;
      if (lead.browserSession && lead.browserSession.sessionId === sessionId) {
        lead.browserSession = undefined;
        lead.currentSessionId = null;
        clearedSessions = 1;
        sessionFound = true;
      } else {
        const initialLength = lead.sessionHistory?.length || 0;
        lead.sessionHistory =
          lead.sessionHistory?.filter(
            (session) => session.sessionId !== sessionId
          ) || [];
        if (lead.sessionHistory.length < initialLength) {
          clearedSessions = 1;
          sessionFound = true;
        }
      }
      if (!sessionFound) {
        return res.status(404).json({
          success: false,
          message: "Session not found",
        });
      }
      message = "Session cleared successfully";
    } else {
      if (lead.browserSession) {
        lead.browserSession = undefined;
        lead.currentSessionId = null;
        clearedSessions = 1;
        message = "Current session cleared successfully";
      } else {
        return res.status(404).json({
          success: false,
          message: "No active session to clear",
        });
      }
    }
    await lead.save();
    res.status(200).json({
      success: true,
      message,
      data: {
        leadId,
        clearedSessions,
        hasActiveSession: !!lead.browserSession,
        remainingSessions: lead.sessionHistory?.length || 0,
      },
    });
  } catch (error) {
    console.error("Error clearing session:", error);
    next(error);
  }
};
exports.accessLeadSession = async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const userAgent = req.get("User-Agent");
    const ipAddress = req.ip || req.connection.remoteAddress;
    sessionSecurity.logSessionAccess({
      sessionId: "pending",
      leadId: leadId,
      userId: req.user._id.toString(),
      userRole: req.user.role,
      action: "access_attempt",
      ipAddress: ipAddress,
      userAgent: userAgent,
      success: true,
      metadata: {
        requestType: "session_restoration",
      },
    });
    const lead = await Lead.findById(leadId);
    if (!lead) {
      console.log(`❌ Session access denied - Lead not found: ${leadId}`);
      sessionSecurity.logSessionAccess({
        sessionId: "unknown",
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "access",
        ipAddress: ipAddress,
        userAgent: userAgent,
        success: false,
        errorMessage: "Lead not found",
      });
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (req.user.role === "agent") {
      if (lead.assignedTo?.toString() !== req.user._id.toString()) {
        console.log(
          `❌ Session access denied - Agent ${req.user._id} not assigned to lead ${leadId}`
        );
        sessionSecurity.logSessionAccess({
          sessionId: "unknown",
          leadId: leadId,
          userId: req.user._id.toString(),
          userRole: req.user.role,
          action: "access",
          ipAddress: ipAddress,
          userAgent: userAgent,
          success: false,
          errorMessage: "Access denied - lead not assigned",
        });
        return res.status(403).json({
          success: false,
          message: "Access denied - lead not assigned to you",
        });
      }
    } else if (req.user.role === "affiliate_manager") {
      if (
        lead.assignedTo?.toString() !== req.user._id.toString() &&
        lead.createdBy?.toString() !== req.user._id.toString()
      ) {
        console.log(
          `❌ Session access denied - Affiliate manager ${req.user._id} not authorized for lead ${leadId}`
        );
        sessionSecurity.logSessionAccess({
          sessionId: "unknown",
          leadId: leadId,
          userId: req.user._id.toString(),
          userRole: req.user.role,
          action: "access",
          ipAddress: ipAddress,
          userAgent: userAgent,
          success: false,
          errorMessage: "Access denied - not authorized for lead",
        });
        return res.status(403).json({
          success: false,
          message: "Access denied - lead not assigned to you",
        });
      }
    }
    if (!lead.hasActiveBrowserSession()) {
      console.log(
        `❌ Session access denied - No active session for lead ${leadId}`
      );
      sessionSecurity.logSessionAccess({
        sessionId: "none",
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "access",
        ipAddress: ipAddress,
        userAgent: userAgent,
        success: false,
        errorMessage: "No active session found",
      });
      return res.status(404).json({
        success: false,
        message: "No active session found for this lead",
      });
    }
    const encryptedSessionData = lead.getCurrentBrowserSession();
    let sessionData;
    try {
      sessionData = sessionSecurity.decryptSessionData(encryptedSessionData);
    } catch (decryptionError) {
      console.error("❌ Session decryption failed:", decryptionError);
      sessionSecurity.logSessionAccess({
        sessionId: encryptedSessionData.sessionId || "unknown",
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "access",
        ipAddress: ipAddress,
        userAgent: userAgent,
        success: false,
        errorMessage: "Session decryption failed",
      });
      return res.status(500).json({
        success: false,
        message: "Failed to decrypt session data",
      });
    }
    const integrityValidation =
      sessionSecurity.validateSessionIntegrity(sessionData);
    if (!integrityValidation.isValid) {
      console.log(
        `❌ Session access denied - Invalid session for lead ${leadId}:`,
        integrityValidation.errors
      );
      sessionSecurity.logSessionAccess({
        sessionId: sessionData.sessionId,
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "access",
        ipAddress: ipAddress,
        userAgent: userAgent,
        success: false,
        errorMessage: `Session validation failed: ${integrityValidation.errors.join(
          ", "
        )}`,
      });
      if (integrityValidation.isTampered) {
        return res.status(400).json({
          success: false,
          message: "Session data appears to be tampered with",
        });
      }
      return res.status(400).json({
        success: false,
        message: `Session is invalid: ${integrityValidation.errors.join(", ")}`,
      });
    }
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    if (
      sessionData.lastAccessedAt &&
      sessionData.lastAccessedAt > fiveMinutesAgo
    ) {
      const remainingTime = Math.ceil(
        (sessionData.lastAccessedAt.getTime() + 5 * 60 * 1000 - now.getTime()) /
          1000
      );
      console.log(
        `⏰ Session access rate limited for lead ${leadId} - ${remainingTime}s remaining`
      );
      sessionSecurity.logSessionAccess({
        sessionId: sessionData.sessionId,
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "access",
        ipAddress: ipAddress,
        userAgent: userAgent,
        success: false,
        errorMessage: "Rate limited - too many recent access attempts",
      });
      return res.status(429).json({
        success: false,
        message: `Session was recently accessed. Please wait ${remainingTime} seconds before accessing again.`,
        retryAfter: remainingTime,
      });
    }
    lead.updateSessionAccess(sessionData.sessionId);
    await lead.save();
    sessionSecurity.logSessionAccess({
      sessionId: sessionData.sessionId,
      leadId: leadId,
      userId: req.user._id.toString(),
      userRole: req.user.role,
      action: "access",
      ipAddress: ipAddress,
      userAgent: userAgent,
      success: true,
      metadata: {
        domain: sessionData.metadata?.domain,
        cookieCount: sessionData.cookies?.length || 0,
        integrityHash: sessionSecurity.generateSessionHash(sessionData),
      },
    });
    // Check if EC2 GUI Browser service is available (production mode)
    const EC2_GUI_BROWSER_URL = process.env.EC2_GUI_BROWSER_URL;
    const isProduction =
      process.env.NODE_ENV === "production" || EC2_GUI_BROWSER_URL;

    if (
      isProduction &&
      EC2_GUI_BROWSER_URL &&
      EC2_GUI_BROWSER_URL !== "http://your-ec2-ip:3001"
    ) {
      // Use GUI Browser service for production
      const axios = require("axios");

      try {
        console.log(
          `🚀 Creating GUI browser session via EC2 service for lead ${leadId}`
        );

        const response = await axios.post(
          `${EC2_GUI_BROWSER_URL}/sessions`,
          {
            sessionId: sessionData.sessionId,
            leadId: leadId,
            cookies: sessionData.cookies,
            localStorage: sessionData.localStorage,
            sessionStorage: sessionData.sessionStorage,
            userAgent: sessionData.userAgent,
            viewport: sessionData.viewport,
            domain: sessionData.metadata?.domain,
            leadInfo: {
              firstName: lead.firstName,
              lastName: lead.lastName,
              email: lead.newEmail,
              phone: lead.newPhone,
              country: lead.country,
              countryCode: lead.countryCode,
            },
          },
          {
            timeout: 30000,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.success) {
          console.log(
            `✅ GUI browser session created successfully for lead ${leadId}`
          );

          sessionSecurity.logSessionAccess({
            sessionId: sessionData.sessionId,
            leadId: leadId,
            userId: req.user._id.toString(),
            userRole: req.user.role,
            action: "gui_browser_session_created",
            ipAddress: ipAddress,
            userAgent: userAgent,
            success: true,
            metadata: {
              domain: sessionData.metadata?.domain,
              sessionStatus: response.data.sessionStatus,
            },
          });

          res.status(200).json({
            success: true,
            message: "GUI browser session created successfully!",
            data: {
              leadId,
              sessionId: sessionData.sessionId,
              domain: sessionData.metadata?.domain,
              lastAccessedAt: new Date(),
              sessionStatus: response.data.sessionStatus,
              leadInfo: {
                name: `${lead.firstName} ${lead.lastName}`,
                email: lead.newEmail,
              },
              securityStatus: {
                encrypted: true,
                validated: true,
                integrityHash: sessionSecurity.generateSessionHash(sessionData),
              },
              instructions: {
                title: "GUI Browser Session Created",
                steps: [
                  "The browser session has been created",
                  "Session is ready for interaction",
                  "Fill out forms and interact normally",
                  "Session will be available for use",
                ],
              },
            },
          });
          return; // Exit early if GUI browser succeeds
        } else {
          throw new Error(
            response.data.message || "Failed to create GUI browser session"
          );
        }
      } catch (guiError) {
        console.error(
          `❌ GUI browser session creation failed for lead ${leadId}:`,
          guiError.message
        );

        sessionSecurity.logSessionAccess({
          sessionId: sessionData.sessionId,
          leadId: leadId,
          userId: req.user._id.toString(),
          userRole: req.user.role,
          action: "gui_browser_session_failed",
          ipAddress: ipAddress,
          userAgent: userAgent,
          success: false,
          errorMessage: `GUI browser failed: ${guiError.message}`,
        });

        // Fall back to local script if GUI service fails
        console.log(`⚠️ Falling back to local script for lead ${leadId}`);
      }
    }

    // Launch local session restoration script (development mode or fallback)
    const { spawn } = require("child_process");
    const path = require("path");
    const scriptPath = path.join(__dirname, "../../agent_session_browser.py");
    const sessionDataForScript = {
      leadId: lead._id.toString(),
      sessionId: sessionData.sessionId,
      cookies: sessionData.cookies,
      localStorage: sessionData.localStorage,
      sessionStorage: sessionData.sessionStorage,
      userAgent: sessionData.userAgent,
      viewport: sessionData.viewport,
      domain: sessionData.metadata?.domain,
      leadInfo: {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.newEmail,
        phone: lead.newPhone,
        country: lead.country,
      },
    };
    try {
      const pythonProcess = spawn(
        "python3",
        [scriptPath, JSON.stringify(sessionDataForScript)],
        {
          detached: true,
          stdio: "ignore",
        }
      );
      pythonProcess.unref();
      console.log(`🚀 Session restoration script launched for lead ${leadId}`);
      console.log(`📋 Session ID: ${sessionData.sessionId}`);
      console.log(`🌐 Domain: ${sessionData.metadata?.domain || "N/A"}`);
      sessionSecurity.logSessionAccess({
        sessionId: sessionData.sessionId,
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "script_launch",
        ipAddress: ipAddress,
        userAgent: userAgent,
        success: true,
        metadata: {
          domain: sessionData.metadata?.domain,
          scriptPath: "agent_session_browser.py",
        },
      });
      res.status(200).json({
        success: true,
        message:
          "Session restoration initiated successfully. Browser window should open shortly.",
        data: {
          leadId,
          sessionId: sessionData.sessionId,
          domain: sessionData.metadata?.domain,
          lastAccessedAt: new Date(),
          leadInfo: {
            name: `${lead.firstName} ${lead.lastName}`,
            email: lead.newEmail,
          },
          securityStatus: {
            encrypted: true,
            validated: true,
            integrityHash: sessionSecurity.generateSessionHash(sessionData),
          },
        },
      });
    } catch (scriptError) {
      console.error("Error launching session restoration script:", scriptError);
      console.log(
        `❌ Script launch failed for lead ${leadId}:`,
        scriptError.message
      );
      sessionSecurity.logSessionAccess({
        sessionId: sessionData.sessionId,
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "script_launch",
        ipAddress: ipAddress,
        userAgent: userAgent,
        success: false,
        errorMessage: `Script launch failed: ${scriptError.message}`,
      });
      res.status(200).json({
        success: true,
        message:
          "Session data retrieved successfully, but browser restoration script failed to launch. Please contact support.",
        data: {
          leadId,
          sessionId: sessionData.sessionId,
          domain: sessionData.metadata?.domain,
          lastAccessedAt: new Date(),
          scriptError: "Failed to launch browser restoration script",
          securityStatus: {
            encrypted: true,
            validated: true,
            integrityHash: sessionSecurity.generateSessionHash(sessionData),
          },
        },
      });
    }
  } catch (error) {
    console.error("Error accessing session:", error);
    console.log(`❌ Session access error for lead ${req.params.id}:`, {
      error: error.message,
      userId: req.user._id,
      timestamp: new Date().toISOString(),
    });
    sessionSecurity.logSessionAccess({
      sessionId: "unknown",
      leadId: req.params.id,
      userId: req.user._id.toString(),
      userRole: req.user.role,
      action: "access",
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      success: false,
      errorMessage: `System error: ${error.message}`,
    });
    next(error);
  }
};
