module.exports = function (router) {
    const Task = require('../models/task');
    const User = require('../models/user');
    const mongoose = require('mongoose');

    var tasksRoute = router.route('/tasks');
    var tasksIdRoute = router.route('/tasks/:id');

    // GET /tasks
    tasksRoute.get(async function (req, res) {
        try {
            const {where, sort, select, skip, limit, count} = req.query;

            let query = Task.find().select('-__v');
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
                    query = query.limit(100);
                }
                if (count === "true") {
                    const total = await Task.countDocuments(query.getFilter());
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
                    message: "no tasks found",
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
    
    // POST /tasks
    tasksRoute.post(async function (req, res) {
        const newTask = new Task(req.body)
        const err = newTask.validateSync()

        if (err) {
            res.status(400).json({
                message:"invalid new task",
                data: "invalid new task",
            })
            return;
        }

        const session = await mongoose.startSession();

        try {
            // check new user, add task
            if (newTask.assignedUser !== "") {
                const newUser = await User.findByIdAndUpdate(req.body.assignedUser, {
                    $addToSet: { pendingTasks: newTask._id },
                });
                newTask.assignedUserName = newUser.name;
            }

            let savedTask;
            await session.withTransaction(async () => {
                savedTask = await newTask.save({ session });
            });

            res.status(201).json({
                message: "task created successfully",
                data: savedTask,
            });
        } catch (err) {
            res.status(500).json({
                message:"failed to create new task",
                data: "server error",
            })
        }
    });


    // GET /tasks/:id
    tasksIdRoute.get(async function (req, res) {
        try {
            const taskId = req.params.id;

            if (!mongoose.Types.ObjectId.isValid(taskId)) {
                return res.status(400).json({
                    message: "invalid task id",
                    data: err.message,
                });
            }

            const task = await Task.findById(taskId);

            if (!task) {
                return res.status(404).json({
                    message: "task not found",
                    data: err.message,
                });
            }

            const {where, sort, select, skip, limit, count} = req.query;

            let query = Task.find().select('-__v');
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
                    const total = await Task.countDocuments(query.getFilter());
                    return res.json({ count: total });
                }
            } catch (err) {
                return res.status(400).json({ 
                    message: "invalid request parameter",
                    data: "",
                 });
            }

            res.status(200).json({
                message: "task retrieved successfully",
                data: task,
            });

        } catch (err) {
            res.status(500).json({
                message: "failed to retrieve task",
                data: err.message,
            });
        }
    });

    // PUT /tasks/:id
    tasksIdRoute.put(async function (req, res) {
        try {
            // get task id
            const taskId = req.params.id;

            // validate task id
            if (!mongoose.Types.ObjectId.isValid(taskId)) {
                return res.status(400).json({
                    message: "invalid task id",
                    data: err.message,
                });
            }

            // get old task
            const oldTask = await Task.findById(taskId);
            // ensure old task is valid
            if (!oldTask) {
                return res.status(404).json({
                    message: "task not found",
                    data: "",
                });
            }

            // validate given task
            const newTask = new Task(req.body);
            const err = newTask.validateSync();
            
            if (err) {
                return res.status(400).json({
                    message: "task validation failed",
                    data: err.message,
                });
            }

            // check old user, remove task
            if (oldTask.assignedUser !== "") {
                await User.findByIdAndUpdate(req.body.assignedUser, {
                    $pull: { pendingTasks: oldTask._id },
                });
            }

            // check new user, add task
            if (newTask.assignedUser !== "") {
                const newUser = await User.findByIdAndUpdate(req.body.assignedUser, {
                    $addToSet: { pendingTasks: newTask._id },
                });
                newTask.assignedUserName = newUser.name;
            }

            // save replaced task
            const replacedTask = await Task.findOneAndReplace(
                { _id: taskId },
                newTask,
                { new: true }  // return the new doc
            );

            res.status(200).json({
                message: "task updated successfully",
                data: replacedTask,
            });
        } catch (err) {
            res.status(500).json({
                message: "failed to replace task",
                data: "server error",
            });
        }
    });

    // DELETE /tasks/:id
    tasksIdRoute.delete(async function (req, res) {
        try {
            const taskId = req.params.id;

            // Optional: validate that it's a proper ObjectId before querying
            if (!mongoose.Types.ObjectId.isValid(taskId)) {
                return res.status(400).json({
                    message: "invalid task id",
                    data: err.message,
                });
            }

            const task = await Task.findById(taskId);

            if (!task) {
                return res.status(404).json({
                    message: "task not found",
                    data: "no task found",
                });
            }
            
            if (task.assignedUser !== "") {
                await User.findByIdAndUpdate(task.assignedUser, {
                    $pull: { pendingTasks: task._id },
                });
            }

            await Task.deleteOne({_id: taskId});

            res.status(200).json({
                message: "task deleted successfully",
                data: { _id: taskId },
            });
        } catch (err) {
            res.status(500).json({
                message: "failed to delete task",
                data: "server error",
            });
        }
    });

    return router;
}
