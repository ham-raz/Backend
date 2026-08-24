import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isValidObjectId } from "mongoose";

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const pageNumber = Math.max(Number(page), 1);
  const limitNumber = Math.max(Number(limit), 1);

  const comments = await Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $unwind: "$owner",
    },
    {
      $project: {
        content: 1,
        video: 1,
        createdAt: 1,
        updatedAt: 1,
        owner: {
          _id: "$owner._id",
          username: "$owner.username",
          fullName: "$owner.fullName",
          avatar: "$owner.avatar",
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $skip: (pageNumber - 1) * limitNumber,
    },
    {
      $limit: limitNumber,
    },
  ]);

  const totalComments = await Comment.countDocuments({
    video: videoId,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        comments,
        page: pageNumber,
        limit: limitNumber,
        totalComments,
        totalPages: Math.ceil(totalComments / limitNumber),
      },
      "Comments fetched successfully"
    )
  );
});

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const { content } = req.body;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  if (!content?.trim()) {
    throw new ApiError(400, "Comment content is required");
  }

  const comment = await Comment.create({
    content: content.trim(),
    video: videoId,
    owner: req.user._id,
  });

  const createdComment = await Comment.aggregate([
    {
      $match: {
        _id: comment._id,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $unwind: "$owner",
    },
    {
      $project: {
        content: 1,
        video: 1,
        createdAt: 1,
        updatedAt: 1,
        owner: {
          _id: "$owner._id",
          username: "$owner.username",
          fullName: "$owner.fullName",
          avatar: "$owner.avatar",
        },
      },
    },
  ]);

  return res
    .status(201)
    .json(
      new ApiResponse(201, createdComment[0], "Comment added successfully")
    );
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const { content } = req.body;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment ID");
  }

  if (!content?.trim()) {
    throw new ApiError(400, "Comment content is required");
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this comment");
  }

  comment.content = content.trim();

  await comment.save();

  const updatedComment = await Comment.aggregate([
    {
      $match: {
        _id: comment._id,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $unwind: "$owner",
    },
    {
      $project: {
        content: 1,
        video: 1,
        createdAt: 1,
        updatedAt: 1,
        owner: {
          _id: "$owner._id",
          username: "$owner.username",
          fullName: "$owner.fullName",
          avatar: "$owner.avatar",
        },
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedComment[0], "Comment updated successfully")
    );
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment ID");
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this comment");
  }

  await Comment.findByIdAndDelete(commentId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Comment deleted successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
