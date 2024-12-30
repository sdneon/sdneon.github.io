/*
 Durstenfeld (optimized Fisher–Yates aka Knuth) shuffle.
 Shuffle in-place, by putting randomly selected elements in the back of the array, filling up from backwards =)
*/
function shuffle(array)
{
	let m = array.length, t, i;

	// While there remain elements to shuffle…
	while (m) {
		// Pick a remaining element…
		i = Math.floor(Math.random() * m--);

		// And swap it with the current element.
		t = array[m];
		array[m] = array[i];
		array[i] = t;
	}

	return array;
}

/*
	Variant of shuffle(), and only returns a subset (as a sliced copy of array).
	@param m (int) number of elements needed
*/
function shufflePick(array, m)
{
	if (!m) return shuffle(array);
	let max = array.length;
	if (m > max)
		m = max;
	const p = max - m; //position of 1st element of resultant array
	let t, i;

	// While there remain elements to shuffle…
	while (m) {
		// Pick a remaining element…
		i = Math.floor(Math.random() * max--);

		// And swap it with the current element.
		t = array[max];
		array[max] = array[i];
		array[i] = t;
		--m;
	}

	return array.slice(p);
}
