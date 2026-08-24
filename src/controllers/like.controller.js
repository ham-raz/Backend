import mongoose, { isValidObjectId } from "mongoose";

import { Like } from "../models/like.model.js";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import { Tweet } from "../models/tweet.model.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const existingLike = await Like.findOne({
    video: videoId,
    likedBy: req.user._id,
  });

  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Video unliked successfully"));
  }

  const like = await Like.create({
    video: videoId,
    likedBy: req.user._id,
  });

  const likedVideo = await Like.aggregate([
    {
      $match: {
        _id: like._id,
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
      },
    },
    {
      $unwind: "$video",
    },
    {
      $project: {
        _id: 1,
        video: 1,
        likedBy: 1,
        createdAt: 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, likedVideo[0], "Video liked successfully"));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment ID");
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  const existingLike = await Like.findOne({
    comment: commentId,
    likedBy: req.user._id,
  });

  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Comment unliked successfully"));
  }

  const like = await Like.create({
    comment: commentId,
    likedBy: req.user._id,
  });

  const likedComment = await Like.aggregate([
    {
      $match: {
        _id: like._id,
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "comment",
        foreignField: "_id",
        as: "comment",
      },
    },
    {
      $unwind: "$comment",
    },
    {
      $project: {
        _id: 1,
        comment: 1,
        likedBy: 1,
        createdAt: 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, likedComment[0], "Comment liked successfully"));
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet ID");
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  const existingLike = await Like.findOne({
    tweet: tweetId,
    likedBy: req.user._id,
  });

  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Tweet unliked successfully"));
  }

  const like = await Like.create({
    tweet: tweetId,
    likedBy: req.user._id,
  });

  const likedTweet = await Like.aggregate([
    {
      $match: {
        _id: like._id,
      },
    },
    {
      $lookup: {
        from: "tweets",
        localField: "tweet",
        foreignField: "_id",
        as: "tweet",
      },
    },
    {
      $unwind: "$tweet",
    },
    {
      $project: {
        _id: 1,
        tweet: 1,
        likedBy: 1,
        createdAt: 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, likedTweet[0], "Tweet liked successfully"));
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const pageNumber = Math.max(Number(page), 1);
  const limitNumber = Math.max(Number(limit), 1);

  const likedVideos = await Like.aggregate([
    {
      $match: {
        likedBy: new mongoose.Types.ObjectId(req.user._id),
        video: {
          $exists: true,
          $ne: null,
        },
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
      },
    },
    {
      $unwind: "$video",
    },
    {
      $lookup: {
        from: "users",
        localField: "video.owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $unwind: "$owner",
    },
    {
      $project: {
        _id: 1,
        createdAt: 1,
        video: {
          _id: "$video._id",
          videoFile: "$video.videoFile",
          thumbnail: "$video.thumbnail",
          title: "$video.title",
          description: "$video.description",
          duration: "$video.duration",
          views: "$video.views",
          isPublished: "$video.isPublished",
          createdAt: "$video.createdAt",
          owner: {
            _id: "$owner._id",
            username: "$owner.username",
            fullName: "$owner.fullName",
            avatar: "$owner.avatar",
          },
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

  const totalLikedVideos = await Like.countDocuments({
    likedBy: req.user._id,
    video: {
      $exists: true,
      $ne: null,
    },
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        likedVideos,
        page: pageNumber,
        limit: limitNumber,
        totalLikedVideos,
        totalPages: Math.ceil(totalLikedVideos / limitNumber),
      },
      "Liked videos fetched successfully"
    )
  );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
