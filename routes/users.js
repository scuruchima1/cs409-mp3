module.exports = function (router) {
    const Task = require('../models/task');
    const User = require('../models/user');
    const mongoose = require('mongoose');

    var usersRoute = router.route('/users');
    var usersIdRoute = router.route('/users/:id');

    // Parameter	Description
    // where	    filter results based on JSON query
    // sort	        specify the order in which to sort each specified field (1- ascending; -1 - descending)
    // select	    specify the set of fields to include or exclude in each document (1 - include; 0 - exclude)
    // skip	        specify the number of results to skip in the result set; useful for pagination
    // limit	    specify the number of results to return (default should be 100 for tasks and unlimited for users)
    // count	    if set to true, return the count of documents that match the query (instead of the documents themselves)

    usersRoute.get(async function (req, res) {
        try {
            const {where, sort, select, skip, limit, count} = req.query;

            let query = User.find().select('-__v');
            try {
                if (where) {
                    const filter = JSON.parse(where);
                    query = query.where(filter);
                }
                if (sort) {
                    const sortObj = JSON.parse(sort);
                    query = query.sort(sortObj);
                }
                if (select) {
                    const selectObj = JSON.parse(select);
                    query = query.select(selectObj);
                }
                if (skip) {
                    query = query.skip(parseInt(skip, 10));
                }
                if (limit) {
                    query = query.limit(parseInt(limit, 10));
                } else {
                    query = query.limit(0);
                }
                if (count === "true") {
                    const total = await User.countDocuments(query.getFilter());
                    return res.json({ count: total });
                }
            } catch {
                return res.status(400).json({ 
                    message: "invalid request parameter",
                    data: "",
                 });
            }

            const results = await query.exec();

            if (results.length === 0) {
                return res.status(204).json({
                    message: "No users found",
                    data: []
                });
            }

            res.status(200).json({
                message: "OK",
                data: results,
            });

        } catch (err) {
            res.status(500).json({ 
                message: "server error", 
                data: "" 
            });
        }
    });

    // 200 (success), 201 (created), 204(no content), 400(bad request), 404 (not found), 500 (server error).

    // POST /users
    // require name and email
    // require unqiue email
    // specify default vals
    usersRoute.post(async function (req, res) {
        const newUser = new User(req.body)
        const err = newUser.validateSync()

        if (err) {
            // handle errs
            res.status(400).json({
                message:"invalid new user",
                data: "invalid new user",
            })
            return;
        }

        const session = await mongoose.startSession();

        try {
            let savedUser;
            await session.withTransaction(async () => {
                savedUser = await newUser.save({ session });
            });

            res.status(201).json({
                message: "user created successfully",
                data: savedUser,
            });
        } catch (err) {
            if (err.code === 11000) {
                return res.status(400).json({ 
                    message: "user with email already exists",
                    data: "bad request",
                });
            }
            res.status(500).json({
                message:"failed new users",
                data: "server error",
            })
        }
    });

    // GET /users/:id
    // require name and email
    // require unqiue email
    // specify default vals
    usersIdRoute.get(async function (req, res) {
        try {
            const userId = req.params.id;

            // Optional: validate that it's a proper ObjectId before querying
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({
                    message: "Invalid user ID format",
                    data: err.message,
                });
            }

            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    data: err.message,
                });
            }

            const {where, sort, select, skip, limit, count} = req.query;

            let query = User.find().select('-__v');
            try {
                if (where) {
                    const filter = JSON.parse(where);
                    query = query.where(filter);
                }
                if (sort) {
                    const sortObj = JSON.parse(sort);
                    query = query.sort(sortObj);
                }
                if (select) {
                    const selectObj = JSON.parse(select);
                    query = query.select(selectObj);
                }
                if (skip) {
                    query = query.skip(parseInt(skip, 10));
                }
                if (limit) {
                    query = query.limit(parseInt(limit, 10));
                } else {
                    query = query.limit(0);
                }
                if (count === "true") {
                    const total = await User.countDocuments(query.getFilter());
                    return res.json({ count: total });
                }
            } catch (err) {
                return res.status(400).json({ 
                    message: "invalid request parameter",
                    data: "",
                 });
            }

            res.status(200).json({
                message: "User retrieved successfully",
                data: user,
            });

        } catch (err) {
            res.status(500).json({
                message: "Failed to retrieve user",
                data: err.message,
            });
        }
    });

    usersIdRoute.put(async function (req, res) {
        try {
            // get user id
            const userId = req.params.id;

            // validate user id
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({
                    message: "invalid user id",
                    data: err.message,
                });
            }

            // get old user
            const oldUser = await User.findById(userId);
            // ensure old task is valid
            if (!oldUser) {
                return res.status(404).json({
                    message: "user not found",
                    data: "",
                });
            }

            // validate updates
            const newUser = new User(req.body);
            const err = newUser.validateSync();

            if (err) {
                return res.status(400).json({
                    message: "user validation failed",
                    data: err.message,
                });
            }

            const oldTasks = oldUser.pendingTasks; 
            const newTasks = newUser.pendingTasks; 

            // added tasks
            const addedTasks = newTasks.filter(id => !oldTasks.includes(id));
            // removed tasks
            const removedTasks = oldTasks.filter(id => !newTasks.includes(id));
            if (addedTasks.length > 0) {
                await Task.updateMany(
                    { _id: { $in: addedTasks } },
                    { assignedUser: replacedUser._id, assignedUserName: replacedUser.name }
                );
            }
            if (removedTasks.length > 0) {
                await Task.updateMany(
                    { _id: { $in: removedTasks } },
                    {assignedUser: "", assignedUserName: "unassigned"}
                );
            }

            // save replaced user
            const replacedUser = await User.findOneAndReplace(
                { _id: userId },
                newUser,
                { new: true }  // return the new doc
            );

            res.status(200).json({
                message: "user updated successfully",
                data: replacedUser,
            });
        } catch (err) {
            res.status(500).json({
                message: "failed to update user",
                data: "server error",
            });
        }
    });

    usersIdRoute.delete(async function (req, res) {
        try {
            // get user id
            const userId = req.params.id;

            // validate user id
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({
                    message: "invalid user id",
                    data: err.message,
                });
            }
            // get user
            const user = await User.findById(userId);
            // ensure user is valid
            if (!user) {
                return res.status(404).json({
                    message: "user not found",
                    data: "no user found",
                });
            }

            // update tasks
            if (user.pendingTasks) {
                await Task.updateMany(
                    { _id: {$in: user.pendingTasks}},
                    {assignedUser: "", assignedUserName: "unassigned"}
                );
            }

            // delete user
            await User.deleteOne({_id: userId});

            res.status(200).json({
                message: "user deleted successfully",
                data: { _id: userId },
            });
        } catch (err) {
            res.status(500).json({
                message: "Failed to delete user",
                data: "server error",
            });
        }
    });

    return router;
}

// Your API should guarantee two-way reference between Task and User for the following methods:

// PUT a Task with assignedUser and assignedUserName
// DELETE a Task should remove the task from its assignedUser's pendingTasks
// PUT a User with pendingTasks
// DELETE a User should unassign the user's pending tasks
