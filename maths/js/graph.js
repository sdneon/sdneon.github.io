const GIRD_MINI_WIDTH = [
	0.1, 1.0,
	2, 10, 20
];
class GridQn {
	constructor()
	{
		//1. rand small grid width of 0.1, 1.0, 2, 5, 10, 20
		//   and num of small grid: 5 or 10
		//2. rand start & end grid values
		//3. rand @small grid line or @ middle of small grid
		//   and which small gird
		//4. compute answer

		//1.
		this.miniGridWidth = GIRD_MINI_WIDTH[randInt(GIRD_MINI_WIDTH.length)];
		this.numMiniGrid = Math.random() < 0.5? 5: 10;
		//this.numMiniGrid = 10; //TEMP
		//2.
		this.floatNotInt = Math.random() < 0.5? true: false;
		this.v1 = (Math.random() * 200) - 100;
		if (this.floatNotInt)
		{
			if (this.miniGridWidth >= 1)
			{
				this.v1 = this.v1 - (this.v1 % 10);
			}
			this.v1 = Number(this.v1.toPrecision(1));
		}
		else //int
		{
			if (this.miniGridWidth >= 1)
			{
				//use nicer rounded numbers!
				if (this.v1 < 10) this.v1 = 10;
				else
				{
					//this.v1 = this.v1 - (this.v1 % 10);
					this.v1 = (randInt(4) - 2) * 50;
				}
			}
			this.v1 = this.v1 | 0;
		}
		if (this.numMiniGrid === 5)
		{
			//check if need to re-centre a zero
			if ((this.v1 < 0) && (this.v3 > 0) && (this.v2 !== 0))
			{
				this.v1 -= this.v2;
				this.v3 -= this.v2;
				this.v2 = (this.v1 + this.v3) * 0.5;
				console.log('recentred zero');
			}
		}
		this.v2 = this.v1 + (this.numMiniGrid * this.miniGridWidth);
		this.v3 = this.v1 + (this.numMiniGrid * 2 * this.miniGridWidth);
		//3.
		this.whichMiniGrid = randInt(this.numMiniGrid - 2) + 1;
		this.midGrid = Math.random() < 0.5? true: false;
		//this.midGrid = false; //TEMP
		//always assume -1/2 mini grid
		this.gridIndex = this.whichMiniGrid;
		if (this.midGrid) this.gridIndex -= 0.5;
		//4.
		this.v = this.v1 + (this.gridIndex * this.miniGridWidth);
	}

	toString()
	{
		return `${this.v1} to ${this.v2}: ${this.gridIndex} -> ${this.v}`;
	}
}
