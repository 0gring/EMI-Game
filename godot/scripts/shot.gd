class_name Shot
## Test helper: with `-- --shot=path.png --frames=N` on the command line, saves
## a screenshot after N frames and quits. Used to look at scenes headlessly.

static func maybe(node: Node) -> void:
	var path := ""
	var frames := 40
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="):
			path = a.substr(7)
		elif a.begins_with("--frames="):
			frames = int(a.substr(9))
	if path == "":
		return
	var wait := 0.0
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--wait="):
			wait = float(a.substr(7))
	if wait > 0.0:
		await node.get_tree().create_timer(wait).timeout
	for i in frames:
		await node.get_tree().process_frame
	await RenderingServer.frame_post_draw
	node.get_viewport().get_texture().get_image().save_png(path)
	node.get_tree().quit()
